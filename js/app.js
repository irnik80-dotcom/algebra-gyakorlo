/* Algebra gyakorló — felület */
(function () {
  'use strict';
  const Alg = window.Alg, AI = Alg.AI, TOPICS = Alg.topics;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = Alg.esc;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('algebra.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('algebra.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  const state = {
    topic: Math.min(Math.max(+store.get('topic', 0) || 0, 0), TOPICS.length - 1),
    level: [1, 2, 3].includes(store.get('level', 1)) ? store.get('level', 1) : 1,
    problem: null, count: 0, tries: 0, done: false, revealed: false, last: null,
    stats: store.get('stats', {}), streak: 0, best: store.get('best', 0),
  };
  const topic = () => TOPICS[state.topic];
  const R = s => { try { return Alg.render(Alg.parse(s)); } catch (e) { return esc(s); } };
  const mathSpan = s => '<span class="math">' + R(s) + '</span>';

  // ---------- témakörlista ----------
  function buildTopics() {
    const list = $('#topicList'), sel = $('#topicSelect');
    list.innerHTML = ''; sel.innerHTML = '';
    let group = null, og = null;
    TOPICS.forEach((t, i) => {
      if (t.group !== group) {
        group = t.group;
        const h = document.createElement('div');
        h.className = 'group-title'; h.textContent = Alg.groups[group];
        list.appendChild(h);
        og = document.createElement('optgroup'); og.label = Alg.groups[group]; sel.appendChild(og);
      }
      const b = document.createElement('button');
      b.className = 'topic-btn'; b.dataset.i = i;
      b.innerHTML = `<span class="tnum">${i + 1}</span><span class="tname">${esc(t.title)}</span><span class="tprog" id="prog-${t.id}"></span>`;
      b.addEventListener('click', () => selectTopic(i));
      list.appendChild(b);
      const o = document.createElement('option'); o.value = i; o.textContent = `${i + 1}. ${t.title}`; og.appendChild(o);
    });
    sel.addEventListener('change', () => selectTopic(+sel.value));
    updateProgress();
  }
  function updateProgress() {
    for (const t of TOPICS) {
      const s = state.stats[t.id];
      const el = document.getElementById('prog-' + t.id);
      if (el) el.textContent = s && s.ok ? s.ok + ' ✓' : '';
    }
    const s = state.stats[topic().id] || { ok: 0, tried: 0 };
    const total = Object.values(state.stats).reduce((a, x) => a + (x.ok || 0), 0);
    $('#statsbar').innerHTML =
      `<span>Ebben a témában: <b>${s.ok}</b> helyes / <b>${s.tried}</b> feladat</span>` +
      `<span>Sorozat: <b>${state.streak}</b>${state.streak >= 3 ? ' 🔥' : ''}</span>` +
      `<span>Legjobb sorozat: <b>${state.best}</b></span>` +
      `<span>Összesen megoldva: <b>${total}</b></span>`;
  }
  function bump(field) {
    const id = topic().id;
    const s = state.stats[id] || (state.stats[id] = { ok: 0, tried: 0 });
    s[field]++;
    store.set('stats', state.stats);
  }

  function selectTopic(i) {
    state.topic = i; store.set('topic', i);
    $$('.topic-btn').forEach(b => b.classList.toggle('active', +b.dataset.i === i));
    $('#topicSelect').value = i;
    const t = topic();
    $('#topicKicker').textContent = `${i + 1}. témakör · ${Alg.groups[t.group]}`;
    $('#topicTitle').textContent = t.title;
    $('#topicShort').textContent = t.short;
    $('#theoryBody').innerHTML = t.theory();
    state.count = 0;
    newProblem();
  }
  function setLevel(l) {
    state.level = l; store.set('level', l);
    $$('.levels button').forEach(b => b.classList.toggle('active', +b.dataset.level === l));
    newProblem();
  }

  // ---------- feladat ----------
  function newProblem() {
    state.problem = topic().gen(state.level);
    state.count++; state.tries = 0; state.done = false; state.revealed = false; state.last = null;
    $('#problemNo').textContent = `${state.count}. feladat · ${['', 'könnyű', 'közepes', 'nehéz'][state.level]}`;
    $('#prompt').textContent = state.problem.prompt;
    $('#expr').innerHTML = R(state.problem.expr);
    $('#answer').value = '';
    $('#work').value = '';
    $('#preview').innerHTML = '';
    setFeedback('', '');
    hideAi();
    $('#checkBtn').textContent = 'Ellenőrzés';
    updateProgress();
    if (window.matchMedia('(min-width: 861px)').matches) $('#answer').focus({ preventScroll: true });
  }

  function updatePreview() {
    const v = $('#answer').value.trim();
    if (!v) { $('#preview').innerHTML = ''; return; }
    try {
      $('#preview').innerHTML = '<span class="pv-label">Így értem:</span>' + '<span class="math">' + Alg.render(Alg.parse(v)) + '</span>';
    } catch (e) {
      $('#preview').innerHTML = '<span class="pv-err">⚠ ' + esc(e.message) + '</span>';
    }
  }

  function setFeedback(cls, html) {
    const f = $('#feedback');
    f.className = 'feedback' + (cls ? ' ' + cls : '');
    f.innerHTML = html;
  }

  function doCheck() {
    if (state.done) { newProblem(); return; }
    const p = state.problem;
    const res = Alg.check(p, $('#answer').value);
    state.last = res;
    if (res.kind === 'empty' || res.kind === 'syntax') { setFeedback('warn', esc(res.msg)); return; }
    state.tries++;
    if (state.tries === 1) bump('tried');
    if (res.kind === 'correct') {
      state.done = true;
      if (!state.revealed) {
        bump('ok');
        state.streak++;
        if (state.streak > state.best) { state.best = state.streak; store.set('best', state.best); }
      }
      setFeedback('ok', `<strong>✔ ${esc(res.msg)}</strong>` +
        (state.tries > 1 ? `<span>${state.tries}. próbálkozásra sikerült — kitartás!</span>` : '') +
        '<div class="actions"><button class="btn primary" id="nextBtn">Következő feladat →</button></div>');
      $('#nextBtn').addEventListener('click', newProblem);
      $('#checkBtn').textContent = 'Következő →';
    } else if (res.kind === 'form') {
      setFeedback('warn', `<strong>Majdnem!</strong>${esc(res.msg)}`);
    } else {
      state.streak = 0;
      setFeedback('bad', `<strong>✘ Nem jó</strong>${esc(res.msg)}` +
        (state.tries >= 2 ? '<br>Írd le a levezetésedet, és kérd az <b>AI ellenőrzést</b> — megmutatja, hol csúszott el.' : ''));
    }
    updateProgress();
  }

  function showSolution() {
    state.revealed = true;
    state.streak = 0;
    setFeedback('info', `<strong>A helyes eredmény:</strong>${mathSpan(state.problem.answer)}` +
      '<div class="actions"><button class="btn ai" id="explainBtn">✦ Lépésenkénti levezetés</button>' +
      '<button class="btn" id="nextBtn2">Új feladat ↻</button></div>');
    $('#explainBtn').addEventListener('click', () => runAi('Levezetés', () => AI.explain(topic(), state.problem)));
    $('#nextBtn2').addEventListener('click', newProblem);
    updateProgress();
  }

  // ---------- AI ----------
  function hideAi() { const b = $('#aiBox'); b.hidden = true; b.innerHTML = ''; b.classList.remove('error'); }
  async function runAi(title, fn, box = $('#aiBox'), btns = ['#aiCheckBtn', '#hintBtn']) {
    if (!AI.hasKey()) { openSettings('Az AI-funkciókhoz először add meg az API-kulcsot.'); return; }
    box.hidden = false; box.classList.remove('error');
    box.innerHTML = `<h4>✦ ${esc(title)}</h4><span class="loading"><i></i><i></i><i></i> gondolkodom…</span>`;
    btns.forEach(s => { const b = $(s); if (b) b.disabled = true; });
    try {
      const text = await fn();
      box.innerHTML = `<h4>✦ ${esc(title)}</h4>` + AI.md(text || '(üres válasz)');
    } catch (e) {
      box.classList.add('error');
      box.innerHTML = `<h4>Hiba</h4><p>${esc(e.message)}</p>`;
      if (e.code === 'NOKEY') openSettings(e.message);
    } finally {
      btns.forEach(s => { const b = $(s); if (b) b.disabled = false; });
    }
  }
  function verdictText() {
    const ans = $('#answer').value.trim();
    if (!ans) return 'a diák nem adott meg végeredményt';
    const r = Alg.check(state.problem, ans);
    switch (r.kind) {
      case 'correct': return 'HELYES (egyenlő a helyes eredménnyel, és megfelelő az alakja)';
      case 'form': return r.valueOk === false ? 'NEM MEGFELELŐ válasz: ' + r.msg : 'az ÉRTÉKE helyes, de az alakja nem megfelelő: ' + r.msg;
      case 'wrong': return 'HIBÁS (nem egyenlő a helyes eredménnyel)';
      default: return 'nem értelmezhető beírás (' + r.msg + ')';
    }
  }
  function aiCheck() {
    const ans = $('#answer').value, work = $('#work').value;
    if (!ans.trim() && !work.trim()) {
      setFeedback('warn', 'Írd be a végeredményt vagy a levezetésedet, hogy az AI át tudja nézni!');
      return;
    }
    const verdict = verdictText();
    if (!state.revealed && !state.done && state.last === null) setFeedback('', '');
    runAi('AI ellenőrzés', () => AI.review(topic(), state.problem, ans, work, verdict));
  }

  // ---------- gyorsgombok ----------
  const KEYS = [
    { l: '<i>x</i>', t: 'x' }, { l: '<i>y</i>', t: 'y' }, { l: '□²', t: '^2' }, { l: '□³', t: '^3' }, { l: '^', t: '^' },
    { l: '( )', t: '()', back: 1 }, { l: '(', t: '(' }, { l: ')', t: ')' }, { l: '·', t: '*' }, { l: '−', t: '-' }, { l: '/', t: '/' },
  ];
  function buildKeys() {
    const box = $('#keys');
    for (const k of KEYS) {
      const b = document.createElement('button');
      b.type = 'button'; b.innerHTML = k.l; b.title = 'Beszúrás: ' + k.t;
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', () => {
        const el = $('#answer');
        const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? s;
        el.value = el.value.slice(0, s) + k.t + el.value.slice(e);
        const pos = s + k.t.length - (k.back || 0);
        el.focus(); el.setSelectionRange(pos, pos);
        updatePreview();
      });
      box.appendChild(b);
    }
  }

  // ---------- beállítások ----------
  function refreshAiStatus() {
    const on = AI.hasKey();
    $('#settingsBtn').classList.toggle('on', on);
    $('#aiStatusText').textContent = on ? 'AI bekapcsolva' : 'AI beállítása';
  }
  function fillModels(list) {
    const sel = $('#model'), cur = AI.getModel();
    sel.innerHTML = '';
    const add = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); };
    add(AI.AUTO, 'Automatikus (ajánlott) — a legjobb ingyenes Flash modell');
    for (const mm of list || []) add(mm.id, mm.label + ' (' + mm.id + ')');
    if (cur !== AI.AUTO && !(list || []).some(mm => mm.id === cur)) add(cur, cur);
    sel.value = cur;
  }
  function openSettings(msg) {
    $('#apiKey').value = AI.getKey();
    fillModels([]);
    if (AI.hasKey()) AI.listModels().then(fillModels).catch(() => {});
    const m = $('#settingsMsg');
    m.className = 'feedback' + (msg ? ' warn' : ''); m.textContent = msg || '';
    const d = $('#settings');
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }
  function closeSettings() { const d = $('#settings'); if (d.close) d.close(); else d.removeAttribute('open'); }
  function buildSettings() {
    $('#settingsBtn').addEventListener('click', () => openSettings());
    $('#closeSettings').addEventListener('click', closeSettings);
    $('#saveSettings').addEventListener('click', () => {
      AI.setKey($('#apiKey').value.trim()); AI.setModel($('#model').value);
      refreshAiStatus(); closeSettings();
    });
    $('#copyLink').addEventListener('click', async () => {
      const m = $('#settingsMsg'), link = setupLink();
      if (!link) { m.className = 'feedback warn'; m.textContent = 'Előbb add meg a kulcsot.'; return; }
      try { await navigator.clipboard.writeText(link); m.className = 'feedback ok'; m.textContent = '✔ Beállító link kimásolva. Küldd el magadnak/a gyereknek, és nyisd meg egyszer azon az eszközön.'; }
      catch (e) { m.className = 'feedback info'; m.innerHTML = 'Másold ki ezt a linket:<br><code style="word-break:break-all">' + esc(link) + '</code>'; }
    });
    $('#clearKey').addEventListener('click', () => {
      AI.setKey(''); $('#apiKey').value = ''; refreshAiStatus();
      const m = $('#settingsMsg'); m.className = 'feedback info'; m.textContent = 'A kulcs törölve ebből a böngészőből.';
    });
    $('#testKey').addEventListener('click', async () => {
      const m = $('#settingsMsg');
      const prevKey = AI.getKey(), prevModel = AI.getModel();
      AI.setKey($('#apiKey').value.trim()); AI.setModel($('#model').value);
      m.className = 'feedback info'; m.innerHTML = '<span class="loading"><i></i><i></i><i></i> tesztelés…</span>';
      try {
        await AI.test();
        const used = AI.lastModelUsed();
        m.className = 'feedback ok'; m.textContent = '✔ A kapcsolat működik' + (used ? ' (' + used + ')' : '') + '! Ne felejtsd el menteni.';
        const sel = $('#model').value;
        fillModels(await AI.listModels()); $('#model').value = sel;
      } catch (e) {
        m.className = 'feedback bad'; m.textContent = e.message;
      } finally {
        const sel = $('#model').value;
        AI.setKey(prevKey); AI.setModel(prevModel);
        $('#model').value = sel;
      }
    });
  }

  // ---------- saját feladat ----------
  let ownImage = null;
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1600, sc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Ezt a képet nem tudom megnyitni.')); };
      img.src = url;
    });
  }
  function buildOwn() {
    $('#ownImage').addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        ownImage = await loadImage(f);
        $('#ownImgPreview').src = ownImage; $('#ownImgPreview').hidden = false;
        $('#ownImageName').textContent = f.name; $('#ownImageClear').hidden = false;
      } catch (err) { $('#ownImageName').textContent = err.message; }
    });
    $('#ownImageClear').addEventListener('click', () => {
      ownImage = null; $('#ownImage').value = '';
      $('#ownImgPreview').hidden = true; $('#ownImageName').textContent = ''; $('#ownImageClear').hidden = true;
    });
    $('#ownBtn').addEventListener('click', () => {
      const task = $('#ownTask').value, sol = $('#ownWork').value;
      const out = $('#ownOut');
      if (!task.trim() && !sol.trim() && !ownImage) {
        out.hidden = false; out.classList.add('error');
        out.innerHTML = '<p>Írd be a feladatot és a megoldásodat, vagy tölts fel egy fotót!</p>';
        return;
      }
      runAi('AI ellenőrzés', () => AI.checkOwn(task, sol, ownImage, $('#ownFull').checked), out, ['#ownBtn']);
    });
  }

  // ---------- nézetek ----------
  function showView(v) {
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
    $('#view-practice').hidden = v !== 'practice';
    $('#view-own').hidden = v !== 'own';
  }

  // ---------- beállító link: …/#kulcs=AIza… ----------
  // A kulcs így nem kerül be a repóba; a linket egyszer megnyitva az eszköz megjegyzi.
  function keyFromLink() {
    const m = location.hash.match(/(?:^#|&)(?:kulcs|key|gemini)=([^&]+)/);
    if (!m) return;
    const key = decodeURIComponent(m[1]).trim();
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
    if (key.length < 20) return;
    AI.setKey(key);
    refreshAiStatus();
    setTimeout(() => setFeedback('ok', '<strong>✔ Az AI be van állítva ezen az eszközön.</strong>Mostantól az AI-gombok itt mindig működnek.'), 0);
  }
  function setupLink() {
    const key = $('#apiKey').value.trim() || AI.getKey();
    return key ? location.origin + location.pathname + '#kulcs=' + encodeURIComponent(key) : '';
  }

  // ---------- indítás ----------
  function init() {
    buildTopics(); buildKeys(); buildSettings(); buildOwn(); refreshAiStatus();
    $$('.levels button').forEach(b => b.addEventListener('click', () => setLevel(+b.dataset.level)));
    $$('.levels button').forEach(b => b.classList.toggle('active', +b.dataset.level === state.level));
    $$('.tab').forEach(t => t.addEventListener('click', () => showView(t.dataset.view)));
    $('#answer').addEventListener('input', updatePreview);
    $('#answer').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doCheck(); } });
    $('#checkBtn').addEventListener('click', doCheck);
    $('#newBtn').addEventListener('click', newProblem);
    $('#showBtn').addEventListener('click', showSolution);
    $('#aiCheckBtn').addEventListener('click', aiCheck);
    $('#hintBtn').addEventListener('click', () => {
      if (!AI.hasKey()) {
        $('#theory').open = true;
        setFeedback('info', 'Nézd meg az <b>Elmélet és példák</b> részt fent! Személyre szabott tipphez állítsd be az AI-t (jobb felső sarok).');
        return;
      }
      if (!state.revealed && !state.done) setFeedback('', '');
      runAi('Tipp', () => AI.hint(topic(), state.problem, $('#work').value));
    });
    selectTopic(state.topic);
    keyFromLink();
  }
  init();
})();
