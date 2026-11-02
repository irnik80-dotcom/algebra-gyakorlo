/* Algebra gyakorló — automatikus ellenőrzés.
 * 1) Egyenlő-e a beírt kifejezés a helyes eredménnyel? (véletlen pontokban kiértékelve)
 * 2) Megfelelő-e az alakja? (összevont, szorzat alak, egyszerűsített tört …) */
(function (G) {
  'use strict';
  const Alg = G.Alg;
  const P = Alg.Poly;

  const PRAISE = ['Szuper, ez helyes!', 'Pontosan így van!', 'Helyes, ügyes vagy!', 'Telitalálat!', 'Hibátlan!', 'Így kell ezt csinálni!'];

  function equivalent(a, b) {
    const names = [...new Set([...Alg.vars(a), ...Alg.vars(b)])];
    let valid = 0, tries = 0;
    while (valid < 8 && tries < 80) {
      tries++;
      const env = {};
      for (const n of names) env[n] = Math.random() * 6 - 3;
      let va, vb;
      try { va = Alg.evaluate(a, env); vb = Alg.evaluate(b, env); } catch (e) { continue; }
      if (!isFinite(va) || !isFinite(vb) || Math.abs(va) > 1e8) continue;
      if (Math.abs(va - vb) > 1e-6 * Math.max(1, Math.abs(va), Math.abs(vb))) return false;
      valid++;
    }
    return valid >= 4;
  }

  const stripNeg = n => { while (n.type === 'neg') n = n.a; return n; };
  const core = n => { while (n.type === 'neg' || n.type === 'paren') n = n.a; return n; };
  function hasNode(n, pred) {
    if (pred(n)) return true;
    return (n.a ? hasNode(n.a, pred) : false) || (n.b ? hasNode(n.b, pred) : false);
  }
  function flattenMul(n) {
    if (n.type === 'op' && n.op === '*') return [...flattenMul(n.a), ...flattenMul(n.b)];
    return [n];
  }
  function topTerms(n) {
    if (n.type === 'op' && (n.op === '+' || n.op === '-')) return [...topTerms(n.a), ...topTerms(n.b)];
    return [n];
  }
  function isSimpleMono(n) {
    let nums = 0;
    const seen = new Set();
    for (let f of flattenMul(stripNeg(n))) {
      f = stripNeg(f);
      if (f.type === 'num') { nums++; continue; }
      let v = f;
      if (f.type === 'op' && f.op === '^') {
        if (f.a.type !== 'var' || f.b.type !== 'num') return false;
        v = f.a;
      }
      if (v.type !== 'var' || seen.has(v.n)) return false;
      seen.add(v.n);
    }
    return nums <= 1;
  }
  function isNumLiteral(n) {
    n = core(n);
    return n.type === 'num';
  }

  // --- alakellenőrzések: null = rendben, különben üzenet ---
  function formExpanded(ast) {
    if (hasNode(ast, n => n.type === 'paren')) return 'Az érték jó, de még maradt zárójel — bontsd fel, és vond össze a tagokat!';
    if (hasNode(ast, n => n.type === 'op' && (n.op === '/' || n.op === ':'))) return 'Az érték jó, de végezd el az osztást is!';
    const poly = P.fromAst(ast);
    if (!poly) return 'Az eredményt összevont, zárójel nélküli alakban add meg.';
    const terms = topTerms(ast);
    if (!terms.every(isSimpleMono)) return 'Az érték jó, de a tagokat még egyszerűsítsd (pl. x·x helyett x², 2·3x helyett 6x)!';
    if (terms.length !== Math.max(poly.size, 1)) return 'Az érték jó, de még vannak egynemű tagok, amiket össze lehet vonni!';
    return null;
  }

  function factorsOf(ast) {
    const top = stripNeg(ast);
    if (top.type === 'op' && top.op === '^') return [top];
    if (top.type === 'paren') return factorsOf(top.a).length > 1 ? factorsOf(top.a) : [top];
    return flattenMul(top);
  }
  function formFactored(ast, linear) {
    if (hasNode(ast, n => n.type === 'op' && (n.op === '/' || n.op === ':'))) return 'Az eredményt törtek nélkül, szorzat alakban add meg.';
    const fs = factorsOf(ast);
    let sumFactors = 0;
    let isPowerOfSum = false;
    for (const f of fs) {
      let base = f, exp = 1;
      if (f.type === 'op' && f.op === '^') { base = f.a; exp = f.b.type === 'num' ? f.b.v : 1; }
      const poly = P.fromAst(base);
      if (!poly) return 'Az eredményt szorzat alakban add meg.';
      if (poly.size >= 2) {
        sumFactors++;
        if (exp >= 2) isPowerOfSum = true;
        if (P.intContent(poly) > 1 || Object.keys(P.commonVars(poly)).length > 0)
          return 'Majdnem kész! Az egyik zárójelben maradt még közös tényező — azt is ki lehet emelni.';
        if (linear && P.degree(poly) > 1)
          return 'Jó úton jársz, de még tovább bontható: az egyik zárójeles rész is szorzattá alakítható (nevezetes azonosság vagy két szám, aminek ismert a szorzata és az összege).';
      }
    }
    if (sumFactors === 0 || (fs.length < 2 && !isPowerOfSum))
      return 'Az érték jó, de ez még nem szorzat alak. Emeld ki a közös tényezőt / használd az azonosságot!';
    return null;
  }

  function formFraction(ast, meta) {
    const eN = P.fromAst(Alg.parse(meta.num)), eD = P.fromAst(Alg.parse(meta.den));
    const top = core(ast);
    let divs = 0;
    hasNode(ast, n => { if (n.type === 'op' && (n.op === '/' || n.op === ':')) divs++; return false; });
    if (divs > 1) return 'Az érték jó, de az eredményt egyetlen törtként írd fel: (számláló)/(nevező).';
    let sN, sD;
    if (top.type === 'op' && top.op === '/') { sN = P.fromAst(top.a); sD = P.fromAst(top.b); }
    else { sN = P.fromAst(top); sD = P.constant(1); }
    if (!sN || !sD) return 'Az érték jó, de az eredményt egyetlen törtként írd fel: (számláló)/(nevező).';
    if (P.degree(sD) > P.degree(eD) || P.degree(sN) > P.degree(eN))
      return 'Az érték jó, de a tört még egyszerűsíthető! (Alakítsd szorzattá a számlálót és a nevezőt, és keress közös tényezőt.)';
    const cn = P.intContent(sN), cd = P.intContent(sD);
    if (P.gcd(cn, cd) > 1) return 'Az érték jó, de a számlálót és a nevezőt még egy számmal is lehet egyszerűsíteni!';
    return null;
  }

  function check(problem, input) {
    const src = String(input || '').trim();
    if (!src) return { kind: 'empty', msg: 'Írd be a végeredményt!' };
    let ast;
    try { ast = Alg.parse(src); }
    catch (e) { return { kind: 'syntax', msg: 'Ezt nem tudom értelmezni: ' + e.message }; }

    if (problem.mode === 'number') {
      if (Alg.vars(ast).length) return { kind: 'form', valueOk: false, msg: 'A válasz egyetlen szám legyen — a betűk helyére már be kell helyettesíteni.' };
      let v;
      try { v = Alg.evaluate(ast, {}); } catch (e) { return { kind: 'syntax', msg: 'Ezt nem tudom kiszámolni.' }; }
      const exp = Number(problem.answer);
      if (!isFinite(v) || Math.abs(v - exp) > 1e-9 * Math.max(1, Math.abs(exp)))
        return { kind: 'wrong', msg: 'Ez sajnos nem jó érték. Figyelj a műveleti sorrendre és a negatív számok zárójelezésére!' };
      if (!isNumLiteral(ast)) return { kind: 'form', msg: 'Jó az érték, de számold ki a végeredményt egyetlen számként!' };
      return { kind: 'correct', msg: PRAISE[Math.floor(Math.random() * PRAISE.length)] };
    }

    const known = new Set(Alg.vars(Alg.parse(problem.expr)));
    for (const v of Alg.vars(ast)) if (!known.has(v)) return { kind: 'wrong', msg: `A feladatban nincs „${v}” betű — nem elírás?` };

    const expected = Alg.parse(problem.answer);
    if (!equivalent(ast, expected))
      return { kind: 'wrong', msg: 'Ez sajnos nem egyenlő a helyes eredménnyel. Nézd át a lépéseidet, vagy kérj tippet!' };

    let f = null;
    if (problem.mode === 'expanded') f = formExpanded(ast);
    else if (problem.mode === 'factored') f = formFactored(ast, false);
    else if (problem.mode === 'factoredLinear') f = formFactored(ast, true);
    else if (problem.mode === 'fraction') f = formFraction(ast, problem.meta);
    if (f) return { kind: 'form', msg: f };
    return { kind: 'correct', msg: PRAISE[Math.floor(Math.random() * PRAISE.length)] };
  }

  Object.assign(Alg, { check, equivalent });
})(typeof window !== 'undefined' ? window : globalThis);
