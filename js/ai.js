/* Algebra gyakorló — AI-ellenőrzés a Claude API-val (közvetlenül a böngészőből).
 * Az API-kulcs csak a böngésző localStorage-ában tárolódik, és csak az Anthropic API-nak megy el. */
(function (G) {
  'use strict';
  const Alg = G.Alg;

  const MODELS = [
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — ajánlott' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — gyors, olcsó' },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — legalaposabb' },
  ];
  const DEFAULT_MODEL = MODELS[0].id;

  const ls = {
    get(k) { try { return localStorage.getItem('algebra.' + k); } catch (e) { return null; } },
    set(k, v) { try { if (v == null || v === '') localStorage.removeItem('algebra.' + k); else localStorage.setItem('algebra.' + k, v); } catch (e) { /* ignore */ } },
  };
  let memKey = null; // ha a localStorage nem elérhető
  const getKey = () => ls.get('apiKey') || memKey || '';
  const setKey = k => { memKey = k || null; ls.set('apiKey', k); };
  const getModel = () => ls.get('model') || DEFAULT_MODEL;
  const setModel = m => ls.set('model', m);
  const hasKey = () => !!getKey();

  const SYSTEM = `Türelmes, barátságos magyar matematikatanár vagy, aki 12–15 éves diákoknak segít az algebrai kifejezések gyakorlásában.
Szabályok:
- Mindig magyarul válaszolj, tegezve a diákot, rövid, világos mondatokban.
- Matematikai jelöléshez: hatvány ^ jellel (pl. x^2), szorzás · jellel, törtek (számláló)/(nevező) alakban. LaTeX-et NE használj.
- Ha a diák hibázott: NE add meg rögtön a teljes megoldást. Keresd meg az ELSŐ hibás lépést, nevezd meg, melyik szabályt sértette meg, és adj egy célzott tippet a javításhoz.
- Ha a válasz helyes: dicsérd meg röviden és konkrétan; ha van, mutass egy hasznos észrevételt vagy gyorsabb utat.
- Legfeljebb kb. 150 szóban válaszolj, hacsak nem kérnek teljes levezetést.
- Bátorító hangnem, de ne légy szirupos.`;

  async function call(messages, maxTokens = 900, system = SYSTEM) {
    const key = getKey();
    if (!key) { const e = new Error('Nincs beállítva API-kulcs.'); e.code = 'NOKEY'; throw e; }
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: getModel(), max_tokens: maxTokens, system, messages }),
      });
    } catch (e) {
      throw new Error('Nem sikerült elérni az AI-t (nincs internet, vagy a hálózat blokkolja).');
    }
    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = (j.error && j.error.message) || ''; } catch (e) { /* ignore */ }
      if (res.status === 401) { const e = new Error('Érvénytelen API-kulcs. Ellenőrizd a beállításokban!'); e.code = 'NOKEY'; throw e; }
      if (res.status === 429) throw new Error('Túl sok kérés vagy elfogyott a keret — várj egy kicsit, vagy nézd meg a fiókod egyenlegét.');
      throw new Error(`Az AI hibát jelzett (${res.status}). ${detail}`);
    }
    const j = await res.json();
    return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  }

  const show = s => String(s).replace(/\*/g, '·');
  function taskBlock(topic, p) {
    let s = `Témakör: ${topic.title}\nFeladat: ${p.prompt}\nKifejezés: ${show(p.expr)}\n`;
    s += `Helyes végeredmény (a diák ezt nem látja — ne áruld el egyből, ha hibázott): ${show(p.answer)}\n`;
    return s;
  }

  function review(topic, p, answer, work, verdict) {
    const msg = taskBlock(topic, p) +
      `\nA diák levezetése:\n${work && work.trim() ? work.trim() : '(nem írt levezetést)'}\n` +
      `\nA diák végeredménye: ${answer && answer.trim() ? answer.trim() : '(nem adott meg végeredményt)'}\n` +
      `Az automatikus ellenőrzés szerint: ${verdict}\n\n` +
      'Értékeld a diák munkáját a szabályaid szerint. Ha van levezetés, nézd át lépésenként, és mondd meg, hol csúszott hiba (ha csúszott).';
    return call([{ role: 'user', content: msg }]);
  }

  function hint(topic, p, work) {
    const msg = taskBlock(topic, p) +
      (work && work.trim() ? `\nA diák eddigi munkája:\n${work.trim()}\n` : '\nA diák még nem kezdett bele.\n') +
      '\nA diák elakadt. Adj EGYETLEN rövid tippet a következő lépéshez (max. 2-3 mondat). A végeredményt ne áruld el!';
    return call([{ role: 'user', content: msg }], 400);
  }

  function explain(topic, p) {
    const msg = taskBlock(topic, p).replace(' (a diák ezt nem látja — ne áruld el egyből, ha hibázott)', '') +
      '\nMutasd be a teljes megoldást számozott lépésekben. Minden lépésnél írd le röviden, melyik szabályt használjuk és miért. A végén emeld ki a végeredményt. Itt hosszabb lehetsz, de maradj tömör.';
    return call([{ role: 'user', content: msg }], 1400);
  }

  function checkOwn(task, solution, imageDataUrl, wantFull) {
    const content = [];
    if (imageDataUrl) {
      const [head, data] = imageDataUrl.split(',');
      const mt = (head.match(/data:(.*?);/) || [])[1] || 'image/jpeg';
      content.push({ type: 'image', source: { type: 'base64', media_type: mt, data } });
    }
    content.push({
      type: 'text',
      text: 'A diák egy saját (pl. házi) feladatot küldött ellenőrzésre.\n' +
        `Feladat: ${task && task.trim() ? task.trim() : '(a feladat a képen látható)'}\n` +
        `A diák megoldása: ${solution && solution.trim() ? solution.trim() : (imageDataUrl ? '(a képen látható)' : '(nincs megadva)')}\n\n` +
        'Először nagyon gondosan oldd meg magadban a feladatot, és csak utána értékelj. ' +
        (imageDataUrl ? 'Ha a kép egy része olvashatatlan, mondd meg, melyik. ' : '') +
        (wantFull
          ? 'Értékeld a megoldást, mutasd meg a hibákat, majd add meg a teljes, lépésenkénti helyes megoldást is.'
          : 'Értékeld a megoldást a szabályaid szerint: ha hibás, az első hibát nevezd meg és adj tippet, de a teljes megoldást ne add meg.'),
    });
    return call([{ role: 'user', content }], wantFull ? 1600 : 900);
  }

  function test() {
    return call([{ role: 'user', content: 'Válaszolj egyetlen szóval: működik?' }], 20, 'Röviden válaszolj magyarul.');
  }

  // ---------- egyszerű markdown → HTML ----------
  function md(text) {
    const esc = Alg.esc;
    const inline = s => esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\^\(?(-?\d+)\)?/g, '<sup>$1</sup>');
    const out = [];
    let list = null;
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const raw of String(text).split('\n')) {
      const line = raw.trimEnd();
      let mm;
      if (!line.trim()) { close(); continue; }
      if ((mm = line.match(/^\s*[-*•]\s+(.*)$/))) {
        if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; }
        out.push('<li>' + inline(mm[1]) + '</li>');
      } else if ((mm = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
        if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; }
        out.push('<li>' + inline(mm[1]) + '</li>');
      } else if ((mm = line.match(/^#+\s+(.*)$/))) {
        close(); out.push('<p><strong>' + inline(mm[1]) + '</strong></p>');
      } else {
        close(); out.push('<p>' + inline(line) + '</p>');
      }
    }
    close();
    return out.join('');
  }

  Alg.AI = { MODELS, getKey, setKey, getModel, setModel, hasKey, review, hint, explain, checkOwn, test, md };
})(typeof window !== 'undefined' ? window : globalThis);
