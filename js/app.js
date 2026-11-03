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
  // ---------- napló: feladatonként egy bejegyzés ----------
  // { t: időpont, tp: témakör, lv: szint, e: kifejezés, r: 'ok' | 'wrong' | 'shown', n: próbálkozások, ai: AI-t kért }
  const LOG_MAX = 3000;
  let log = store.get('log', []);
  if (!Array.isArray(log)) log = [];
  function logEntry() {
    if (!state.entry) {
      state.entry = { t: Date.now(), tp: topic().id, lv: state.level, e: state.problem.expr, r: 'wrong', n: 0 };
      log.push(state.entry);
      if (log.length > LOG_MAX) log = log.slice(-LOG_MAX);
    }
    return state.entry;
  }
  const saveLog = () => store.set('log', log);

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
    state.count++; state.tries = 0; state.done = false; state.revealed = false; state.last = null; state.entry = null;
    $('#problemNo').textContent = `${state.count}. feladat · ${['', 'könnyű', 'közepes', 'nehéz'][state.level]}`;
    // a „betű = érték” részeket vastagon kiemeljük: „ha x = −1 és y = −3”
    $('#prompt').innerHTML = esc(state.problem.prompt)
      .replace(/\b([a-z]) = ([−-]?\d+(?:[.,]\d+)?)/g, '<b class="cond"><var>$1</var>&nbsp;=&nbsp;$2</b>');
    $('#expr').innerHTML = R(state.problem.expr);
    $('#answer').value = '';
    $('#work').value = '';
    $('#preview').innerHTML = '';
    setFeedback('', '');
    hideAi();
    $('#checkBtn').textContent = 'Ellenőrzés';
    updateProgress();
    if (window.matchMedia('(min-width: 861px)').matches) $('#answer').focus({ preventScroll: true });
    else fitProblem();
  }

  // mobilon: ha a feladat alja (a gombokkal) nem látszik, annyit görgetünk, hogy egészében látsszon
  function fitProblem() {
    requestAnimationFrame(() => {
      const card = $('.problem').getBoundingClientRect(), act = $('.problem .actions').getBoundingClientRect();
      const over = act.bottom + 8 - window.innerHeight;
      if (over > 0) window.scrollBy({ top: Math.min(over, card.top - 4), behavior: 'smooth' });
    });
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
    const en = logEntry();
    en.n = state.tries;
    if (res.kind === 'correct') {
      state.done = true;
      if (en.r !== 'shown') en.r = 'ok';
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
    saveLog();
    updateProgress();
  }

  function showSolution() {
    if (!state.done) { const en = logEntry(); en.r = 'shown'; saveLog(); }
    state.revealed = true;
    state.streak = 0;
    setFeedback('info', `<strong>A helyes eredmény:</strong>${mathSpan(state.problem.answer)}` +
      '<div class="actions"><button class="btn ai" id="explainBtn">✦ Lépésenkénti levezetés</button>' +
      '<button class="btn" id="nextBtn2">Új feladat ↻</button></div>');
    $('#explainBtn').addEventListener('click', () => runAi('Levezetés', st => AI.explain(topic(), state.problem, st)));
    $('#nextBtn2').addEventListener('click', newProblem);
    updateProgress();
  }

  // ---------- AI ----------
  function hideAi() { const b = $('#aiBox'); b.hidden = true; b.innerHTML = ''; b.classList.remove('error'); }
  async function runAi(title, fn, box = $('#aiBox'), btns = ['#aiCheckBtn', '#hintBtn']) {
    if (!AI.hasKey()) { openSettings('Az AI-funkciókhoz először add meg az API-kulcsot.'); return; }
    box.hidden = false; box.classList.remove('error');
    box.innerHTML = `<h4>✦ ${esc(title)}</h4><span class="loading"><i></i><i></i><i></i> <span class="ld-text">gondolkodom…</span></span>`;
    btns.forEach(s => { const b = $(s); if (b) b.disabled = true; });
    const status = msg => { const t = box.querySelector('.ld-text'); if (t) t.textContent = msg; };
    const slow = setTimeout(() => status('még gondolkodom… (a Google szerverei most lassabbak)'), 8000);
    try {
      const text = await fn(status);
      box.innerHTML = `<h4>✦ ${esc(title)}</h4>` + AI.md(text || '(üres válasz)');
    } catch (e) {
      box.classList.add('error');
      box.innerHTML = `<h4>Hiba</h4><p>${esc(e.message)}</p>`;
      if (e.code === 'NOKEY') openSettings(e.message);
    } finally {
      clearTimeout(slow);
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
    logEntry().ai = 1; saveLog();
    if (!state.revealed && !state.done && state.last === null) setFeedback('', '');
    runAi('AI ellenőrzés', st => AI.review(topic(), state.problem, ans, work, verdict, st));
  }

  // ---------- gyorsgombok ----------
  const KEYS = [
    { l: '<i>x</i>', t: 'x' }, { l: '<i>y</i>', t: 'y' }, { l: '□²', t: '^2' }, { l: '□³', t: '^3' }, { l: '^', t: '^' },
    { l: '( )', t: '()', back: 1 }, { l: '(', t: '(' }, { l: ')', t: ')' }, { l: '+', t: '+' }, { l: '−', t: '-' }, { l: '·', t: '*' }, { l: '/', t: '/' },
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
    $('#settingsBtn').title = AI.usingBuiltin() ? 'AI: a beépített kulcs van használatban' : 'AI beállítások';
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
    $('#apiKey').value = AI.getOwnKey();
    $('#apiKey').placeholder = AI.usingBuiltin() ? 'Beépített kulcs van használatban — ide csak sajátot írj, ha kell' : 'AIza…';
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
      const m = $('#settingsMsg'); m.className = 'feedback info'; m.textContent = 'A saját kulcs törölve ebből a böngészőből' + (AI.usingBuiltin() ? ' — mostantól a beépített kulcs működik.' : '.');
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
      runAi('AI ellenőrzés', st => AI.checkOwn(task, sol, ownImage, $('#ownFull').checked, st), out, ['#ownBtn']);
    });
  }

  // ---------- nézetek ----------
  function showView(v) {
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
    $('#view-practice').hidden = v !== 'practice';
    $('#view-own').hidden = v !== 'own';
    $('#view-results').hidden = v !== 'results';
    if (v === 'results') renderResults();
  }

  // ---------- eredmények ----------
  const DAY = 86400000;
  const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const topicById = id => TOPICS.find(t => t.id === id);
  const topicNo = id => TOPICS.findIndex(t => t.id === id) + 1;
  const pct = (a, b) => (b ? Math.round(100 * a / b) + '%' : '–');
  function summarize(list) {
    const done = list.length, ok = list.filter(e => e.r === 'ok').length;
    const first = list.filter(e => e.r === 'ok' && e.n === 1).length;
    return { done, ok, first, shown: list.filter(e => e.r === 'shown').length, ai: list.filter(e => e.ai).length };
  }
  const fmtDate = t => new Date(t).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
  const fmtTime = t => new Date(t).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  function fmtWhen(t) {
    const d0 = startOfDay(Date.now());
    if (t >= d0) return 'ma ' + fmtTime(t);
    if (t >= d0 - DAY) return 'tegnap ' + fmtTime(t);
    return fmtDate(t) + ' ' + fmtTime(t);
  }
  function minutesActive(list) {
    // gyakorlással töltött idő becslése: egymást követő feladatok közti szünetek (max. 5 perc) összege
    const ts = list.map(e => e.t).sort((a, b) => a - b);
    let m = 0;
    for (let i = 1; i < ts.length; i++) { const d = ts[i] - ts[i - 1]; if (d < 5 * 60e3) m += d; }
    return Math.round((m + ts.length * 30e3) / 60e3);
  }

  function renderResults() {
    $('#resName').value = store.get('name', '');
    const now = Date.now(), d0 = startOfDay(now);
    const today = log.filter(e => e.t >= d0), week = log.filter(e => e.t >= d0 - 6 * DAY);
    const card = (title, list) => {
      const s = summarize(list);
      return `<div class="stat"><span class="stat-t">${title}</span><b>${s.ok}<small> / ${s.done}</small></b>` +
        `<span>helyes · ${pct(s.ok, s.done)}</span><span class="muted">${s.done ? 'kb. ' + minutesActive(list) + ' perc' : '&nbsp;'}</span></div>`;
    };
    $('#resCards').innerHTML = card('Ma', today) + card('Elmúlt 7 nap', week) + card('Összesen', log);

    // 14 napos oszlopdiagram
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const a = d0 - i * DAY, b = a + DAY;
      const l = log.filter(e => e.t >= a && e.t < b);
      days.push({ a, n: l.length, ok: l.filter(e => e.r === 'ok').length });
    }
    const max = Math.max(5, ...days.map(d => d.n));
    $('#resChart').innerHTML = days.map(d => {
      const h = Math.round(100 * d.n / max), ho = d.n ? Math.round(100 * d.ok / d.n) : 0;
      const lbl = new Date(d.a).toLocaleDateString('hu-HU', { weekday: 'narrow' });
      return `<div class="bar" title="${fmtDate(d.a)}: ${d.n} feladat, ${d.ok} helyes">` +
        `<span class="bar-n">${d.n || ''}</span><div class="bar-col" style="height:${h}%"><div class="bar-ok" style="height:${ho}%"></div></div>` +
        `<span class="bar-l${d.a === d0 ? ' today' : ''}">${lbl}</span></div>`;
    }).join('');

    // témakörönként
    const rows = TOPICS.map(t => {
      const l = log.filter(e => e.tp === t.id);
      if (!l.length) return '';
      const s = summarize(l);
      const lv = [1, 2, 3].map(k => l.filter(e => e.lv === k).length);
      const recent = l.slice(-10), rs = summarize(recent);
      return `<tr><td><span class="tnum">${topicNo(t.id)}</span> ${esc(t.title)}</td><td>${s.done}</td>` +
        `<td><b>${s.ok}</b> <span class="muted">(${pct(s.ok, s.done)})</span></td>` +
        `<td class="hide-sm">${s.first}</td><td class="hide-sm">${lv.join(' / ')}</td>` +
        `<td><span class="pill ${rs.done >= 3 ? (rs.ok / rs.done >= 0.8 ? 'good' : rs.ok / rs.done >= 0.5 ? 'mid' : 'low') : ''}">${pct(rs.ok, rs.done)}</span></td>` +
        `<td class="hide-sm">${fmtWhen(l[l.length - 1].t)}</td></tr>`;
    }).join('');
    $('#resTopics').innerHTML = rows ||
      '<tr><td colspan="7" class="muted">Még nincs megoldott feladat. Az eredmények a gyakorlás közben gyűlnek.</td></tr>';

    // utolsó feladatok
    const icon = { ok: '<span class="r-ok">✔</span>', wrong: '<span class="r-bad">✘</span>', shown: '<span class="r-shown">👁</span>' };
    $('#resRecent').innerHTML = log.slice(-20).reverse().map(e => {
      const t = topicById(e.tp);
      return `<li>${icon[e.r] || ''}<span class="math">${R(e.e)}</span>` +
        `<span class="muted">${t ? topicNo(e.tp) + '. ' + esc(t.title) : ''} · ${e.lv}. szint${e.n > 1 ? ' · ' + e.n + '. próbára' : ''}${e.ai ? ' · AI' : ''} · ${fmtWhen(e.t)}</span></li>`;
    }).join('') || '<li class="muted">Még nincs feladat.</li>';
  }

  function reportText() {
    const name = store.get('name', '').trim();
    const now = Date.now(), d0 = startOfDay(now);
    const line = (title, l) => { const s = summarize(l); return `${title}: ${s.done} feladat, ${s.ok} helyes (${pct(s.ok, s.done)})` + (s.shown ? `, ${s.shown}× megnézte a megoldást` : '') + (s.done ? `, kb. ${minutesActive(l)} perc` : ''); };
    const week = log.filter(e => e.t >= d0 - 6 * DAY);
    let txt = `📊 Algebra gyakorló${name ? ' – ' + name : ''}\n${new Date(now).toLocaleString('hu-HU')}\n\n`;
    txt += line('Ma', log.filter(e => e.t >= d0)) + '\n';
    txt += line('Elmúlt 7 nap', week) + '\n';
    txt += line('Összesen', log) + '\n';
    const per = TOPICS.map(t => ({ t, l: week.filter(e => e.tp === t.id) })).filter(x => x.l.length);
    if (per.length) {
      txt += '\nTémakörönként (7 nap):\n';
      for (const { t, l } of per) { const s = summarize(l); txt += `• ${topicNo(t.id)}. ${t.title}: ${s.ok}/${s.done} (${pct(s.ok, s.done)}), szint: ${[...new Set(l.map(e => e.lv))].sort().join(',')}\n`; }
    }
    const weak = per.map(({ t, l }) => ({ t, s: summarize(l) })).filter(x => x.s.done >= 3 && x.s.ok / x.s.done < 0.6);
    if (weak.length) txt += '\nMég gyakorolni kell: ' + weak.map(x => x.t.title).join(', ') + '\n';
    if (log.length) txt += `\nUtoljára gyakorolt: ${fmtWhen(log[log.length - 1].t)}`;
    return txt;
  }

  function buildResults() {
    $('#resName').addEventListener('input', e => store.set('name', e.target.value));
    $('#resShare').addEventListener('click', async () => {
      const txt = reportText(), msg = $('#resMsg');
      if (navigator.share) {
        try { await navigator.share({ title: 'Algebra gyakorló – eredmények', text: txt }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      try { await navigator.clipboard.writeText(txt); msg.className = 'feedback ok'; msg.textContent = '✔ Kimásolva — illeszd be egy üzenetbe.'; }
      catch (e) { msg.className = 'feedback info'; msg.innerHTML = 'Másold ki:<pre class="report">' + esc(txt) + '</pre>'; }
    });
    $('#resReset').addEventListener('click', () => {
      if (!window.confirm('Biztosan törlöd az összes eredményt erről az eszközről?')) return;
      log = []; saveLog(); state.stats = {}; store.set('stats', {}); state.best = 0; store.set('best', 0);
      renderResults(); updateProgress();
    });
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
    const key = $('#apiKey').value.trim() || AI.getOwnKey();
    return key ? location.origin + location.pathname + '#kulcs=' + encodeURIComponent(key) : '';
  }

  // ---------- telepíthető webapp (PWA) ----------
  function setupInstall(inApp) {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (standalone) document.documentElement.classList.add('in-app');
    if (!inApp && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === '127.0.0.1' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    const btn = document.getElementById('installBtn');
    let deferred = null;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault(); deferred = e;
      btn.hidden = false;
    });
    btn.addEventListener('click', async () => {
      if (!deferred) return;
      deferred.prompt();
      try { await deferred.userChoice; } catch (e) { /* ignore */ }
      deferred = null; btn.hidden = true;
    });
    window.addEventListener('appinstalled', () => { btn.hidden = true; });
  }

  // ---------- indítás ----------
  function init() {
    const inApp = /AlgebraGyakorloApp\//.test(navigator.userAgent);
    if (inApp) document.documentElement.classList.add('in-app');
    setupInstall(inApp);
    if (window.matchMedia('(max-width: 860px)').matches) $('#answer').placeholder = 'Végeredmény…';
    buildTopics(); buildKeys(); buildResults(); buildSettings(); buildOwn(); refreshAiStatus();
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
      runAi('Tipp', st => AI.hint(topic(), state.problem, $('#work').value, st));
    });
    selectTopic(state.topic);
    keyFromLink();
  }
  init();
})();
