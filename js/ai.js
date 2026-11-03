/* Algebra gyakorló — AI-ellenőrzés a Google Gemini API-val (ingyenes AI Studio kulccsal, közvetlenül a böngészőből).
 * Az API-kulcs csak a böngésző localStorage-ában tárolódik, és csak a Google Gemini API-nak megy el. */
(function (G) {
  'use strict';
  const Alg = G.Alg;

  // Gemini (Google AI Studio) — ingyenes kulccsal is működik.
  const API = 'https://generativelanguage.googleapis.com/v1beta';
  const AUTO = 'auto';
  // Ha a modellista nem kérdezhető le, ezekkel próbálkozunk sorban.
  const FALLBACK = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];

  const ls = {
    get(k) { try { return localStorage.getItem('algebra.' + k); } catch (e) { return null; } },
    set(k, v) { try { if (v == null || v === '') localStorage.removeItem('algebra.' + k); else localStorage.setItem('algebra.' + k, v); } catch (e) { /* ignore */ } },
  };
  let memKey = null; // ha a localStorage nem elérhető
  const getKey = () => ls.get('geminiKey') || memKey || '';
  const setKey = k => { memKey = k || null; ls.set('geminiKey', k); available = null; };
  const getModel = () => ls.get('geminiModel') || AUTO;
  const setModel = m => ls.set('geminiModel', m === AUTO ? '' : m);
  const hasKey = () => !!getKey();

  const SYSTEM = `Türelmes, barátságos magyar matematikatanár vagy, aki 12–15 éves diákoknak segít az algebrai kifejezések gyakorlásában.
Szabályok:
- Mindig magyarul válaszolj, tegezve a diákot, rövid, világos mondatokban.
- Matematikai jelöléshez: hatvány ^ jellel (pl. x^2), szorzás · jellel, törtek (számláló)/(nevező) alakban. LaTeX-et és $ jeleket NE használj.
- Ha a diák hibázott: NE add meg rögtön a teljes megoldást. Keresd meg az ELSŐ hibás lépést, nevezd meg, melyik szabályt sértette meg, és adj egy célzott tippet a javításhoz.
- Ha a válasz helyes: dicsérd meg röviden és konkrétan; ha van, mutass egy hasznos észrevételt vagy gyorsabb utat.
- Legfeljebb kb. 150 szóban válaszolj, hacsak nem kérnek teljes levezetést.
- Bátorító hangnem, de ne légy szirupos.`;

  // ---------- elérhető modellek ----------
  let available = null; // [{id, label}]
  function version(id) { const m = id.match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; }
  function rank(id) {
    // nagyobb = jobb: újabb verzió, flash > flash-lite, stabil > preview
    let r = version(id) * 10;
    if (/flash-lite/.test(id)) r -= 3; else if (/flash/.test(id)) r += 0; else r -= 6;
    if (/preview|exp/.test(id)) r -= 2;
    return r;
  }
  async function listModels() {
    if (available) return available;
    const key = getKey();
    try {
      const res = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      available = (j.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => ({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name }))
        .filter(m => /^gemini-/.test(m.id) && /flash|pro/.test(m.id)
          && !/omni|tts|audio|live|image|embed|robotics|computer|thinking-exp|transcrib|translat/.test(m.id))
        .sort((a, b) => rank(b.id) - rank(a.id));
      if (!available.length) available = FALLBACK.map(id => ({ id, label: id }));
    } catch (e) {
      available = FALLBACK.map(id => ({ id, label: id }));
    }
    return available;
  }
  async function candidates() {
    const chosen = getModel();
    const list = (await listModels()).map(m => m.id).filter(id => !/pro/.test(id) || chosen === id);
    const order = chosen !== AUTO ? [chosen, ...list.filter(id => id !== chosen)] : list;
    return order.slice(0, 6);
  }

  function errorFor(status, detail) {
    if (status === 400 && /api key|API_KEY/i.test(detail)) { const e = new Error('Érvénytelen API-kulcs. Ellenőrizd a beállításokban!'); e.code = 'NOKEY'; return e; }
    if (status === 401 || status === 403) { const e = new Error('A kulcs nem érvényes, vagy nincs engedélyezve a Gemini API. Ellenőrizd a beállításokban!'); e.code = 'NOKEY'; return e; }
    if (status === 429) return new Error('Elfogyott az ingyenes keret (percenkénti vagy napi limit). Várj egy percet, vagy próbáld holnap — a napi keret éjfél (amerikai idő), azaz kb. reggel 9 körül újraindul.');
    return new Error(`Az AI hibát jelzett (${status}). ${detail}`);
  }

  async function call(messages, maxTokens = 900, system = SYSTEM) {
    const key = getKey();
    if (!key) { const e = new Error('Nincs beállítva API-kulcs.'); e.code = 'NOKEY'; throw e; }
    const contents = messages.map(m => {
      const parts = (typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content).map(p =>
        p.type === 'image' ? { inline_data: { mime_type: p.source.media_type, data: p.source.data } } : { text: p.text });
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    });
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      // a "gondolkodó" modelleknél a gondolkodás is ebből a keretből fogy, ezért bőkezű
      generationConfig: { maxOutputTokens: Math.max(4096, maxTokens * 4), temperature: 0.4 },
    });
    let lastErr = null;
    for (const model of await candidates()) {
      let res;
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctl && setTimeout(() => ctl.abort(), 60000);
      try {
        res = await fetch(`${API}/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body,
          signal: ctl ? ctl.signal : undefined,
        });
      } catch (e) {
        if (e && e.name === 'AbortError') { lastErr = new Error('Az AI most nagyon lassan válaszol. Próbáld újra egy kicsit később.'); continue; }
        throw new Error('Nem sikerült elérni az AI-t (nincs internet, vagy a hálózat blokkolja).');
      } finally {
        if (timer) clearTimeout(timer);
      }
      if (!res.ok) {
        let detail = '';
        try { const j = await res.json(); detail = (j.error && j.error.message) || ''; } catch (e) { /* ignore */ }
        lastErr = errorFor(res.status, detail);
        if (lastErr.code === 'NOKEY') throw lastErr;
        // túlterhelt / elfogyott keret / nem létező modell → próbáljuk a következőt
        if ([404, 429, 500, 503].includes(res.status)) continue;
        throw lastErr;
      }
      const j = await res.json();
      const cand = (j.candidates || [])[0];
      if (!cand) {
        const why = j.promptFeedback && j.promptFeedback.blockReason;
        throw new Error('Az AI nem válaszolt' + (why ? ` (${why}).` : '.'));
      }
      const text = ((cand.content && cand.content.parts) || []).filter(p => p.text && !p.thought).map(p => p.text).join('').trim();
      if (!text) {
        if (cand.finishReason === 'MAX_TOKENS') { lastErr = new Error('Az AI válasza túl hosszú lett, próbáld újra.'); continue; }
        throw new Error('Az AI üres választ adott' + (cand.finishReason ? ` (${cand.finishReason})` : '') + '. Próbáld újra.');
      }
      lastModel = model;
      return text;
    }
    throw lastErr || new Error('Egyik Gemini-modell sem érhető el most.');
  }
  let lastModel = null;

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
    // a Gemini néha LaTeX-szel válaszol — egyszerű, olvasható szöveggé alakítjuk
    text = String(text)
      .replace(/\$\$?([^$]+?)\$\$?/g, '$1')
      .replace(/\\cdot/g, '·').replace(/\\times/g, '·').replace(/\\div/g, ':')
      .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
      .replace(/\\left|\\right/g, '').replace(/\\[,;!]/g, ' ')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1$2');
    for (const raw of text.split('\n')) {
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

  Alg.AI = { AUTO, listModels, lastModelUsed: () => lastModel, getKey, setKey, getModel, setModel, hasKey, review, hint, explain, checkOwn, test, md };
})(typeof window !== 'undefined' ? window : globalThis);
