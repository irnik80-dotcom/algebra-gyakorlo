/* Algebra gyakorló — többváltozós polinomok (generáláshoz és alakellenőrzéshez). */
(function (G) {
  'use strict';
  const Alg = (G.Alg = G.Alg || {});
  const EPS = 1e-9;

  const gcd = (a, b) => { a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b)); while (b) { [a, b] = [b, a % b]; } return a; };

  function keyOf(v) {
    return Object.keys(v).filter(k => v[k] > 0).sort().map(k => k + v[k]).join('') || '1';
  }
  const create = () => new Map();
  function addTerm(p, c, v) {
    const vv = {};
    for (const k in v) if (v[k] > 0) vv[k] = v[k];
    const key = keyOf(vv);
    const cur = p.get(key);
    const nc = (cur ? cur.c : 0) + c;
    if (Math.abs(nc) < EPS) p.delete(key); else p.set(key, { c: nc, v: vv });
    return p;
  }
  const mono = (c, v) => addTerm(create(), c, v || {});
  const constant = c => mono(c, {});
  function add(a, b) {
    const p = create();
    for (const t of a.values()) addTerm(p, t.c, t.v);
    for (const t of b.values()) addTerm(p, t.c, t.v);
    return p;
  }
  function scale(a, k) { const p = create(); for (const t of a.values()) addTerm(p, t.c * k, t.v); return p; }
  const neg = a => scale(a, -1);
  const sub = (a, b) => add(a, neg(b));
  function mul(a, b) {
    const p = create();
    for (const s of a.values()) for (const t of b.values()) {
      const v = { ...s.v };
      for (const k in t.v) v[k] = (v[k] || 0) + t.v[k];
      addTerm(p, s.c * t.c, v);
    }
    return p;
  }
  function pow(a, n) { let r = constant(1); for (let i = 0; i < n; i++) r = mul(r, a); return r; }

  const termDeg = t => Object.values(t.v).reduce((s, e) => s + e, 0);
  const degree = p => (p.size ? Math.max(...[...p.values()].map(termDeg)) : -Infinity);
  const isConst = p => p.size === 0 || (p.size === 1 && p.has('1'));
  const constVal = p => (p.size === 0 ? 0 : p.get('1').c);
  const isMonomial = p => p.size <= 1;

  function cmpTerms(s, t) {
    const ds = termDeg(s), dt = termDeg(t);
    if (ds !== dt) return dt - ds;
    const names = [...new Set([...Object.keys(s.v), ...Object.keys(t.v)])].sort();
    for (const n of names) { const a = s.v[n] || 0, b = t.v[n] || 0; if (a !== b) return b - a; }
    return 0;
  }
  const sortedTerms = p => [...p.values()].sort(cmpTerms);

  function numStr(c) {
    const r = Math.round(c);
    if (Math.abs(c - r) < EPS) return String(r);
    return String(+c.toFixed(6));
  }
  function termBody(t) {
    const names = Object.keys(t.v).sort();
    const vs = names.map(n => n + (t.v[n] > 1 ? '^' + t.v[n] : '')).join('');
    const a = Math.abs(t.c);
    if (!vs) return numStr(a);
    if (Math.abs(a - 1) < EPS) return vs;
    return numStr(a) + vs;
  }
  function toPlain(p) {
    if (p.size === 0) return '0';
    return sortedTerms(p).map((t, i) => {
      const body = termBody(t);
      if (i === 0) return (t.c < 0 ? '-' : '') + body;
      return (t.c < 0 ? ' - ' : ' + ') + body;
    }).join('');
  }

  function evalAt(p, env) {
    let s = 0;
    for (const t of p.values()) {
      let v = t.c;
      for (const k in t.v) v *= Math.pow(env[k], t.v[k]);
      s += v;
    }
    return s;
  }

  // Egész együtthatók legnagyobb közös osztója (ha nem egészek: 1)
  function intContent(p) {
    let g = 0;
    for (const t of p.values()) {
      const r = Math.round(t.c);
      if (Math.abs(t.c - r) > EPS) return 1;
      g = gcd(g, r);
    }
    return g || 1;
  }
  // Minden tagban szereplő betűk a legkisebb kitevőn
  function commonVars(p) {
    let res = null;
    for (const t of p.values()) {
      if (res === null) { res = { ...t.v }; continue; }
      for (const k of Object.keys(res)) {
        const e = Math.min(res[k], t.v[k] || 0);
        if (e > 0) res[k] = e; else delete res[k];
      }
    }
    return res || {};
  }

  function divExact(a, b) {
    if (b.size !== 1) return null;
    const [d] = b.values();
    const p = create();
    for (const t of a.values()) {
      const v = { ...t.v };
      for (const k in d.v) {
        v[k] = (v[k] || 0) - d.v[k];
        if (v[k] < 0) return null;
      }
      addTerm(p, t.c / d.c, v);
    }
    return p;
  }

  // AST -> polinom (null, ha nem polinom, pl. betűs nevezőjű tört)
  function fromAst(n) {
    switch (n.type) {
      case 'num': return constant(n.v);
      case 'var': return mono(1, { [n.n]: 1 });
      case 'paren': return fromAst(n.a);
      case 'neg': { const a = fromAst(n.a); return a && neg(a); }
      case 'op': {
        const a = fromAst(n.a);
        if (!a) return null;
        if (n.op === '^') {
          const e = fromAst(n.b);
          if (!e || !isConst(e)) return null;
          const k = constVal(e);
          if (!Number.isInteger(k) || k < 0 || k > 12) return null;
          return pow(a, k);
        }
        const b = fromAst(n.b);
        if (!b) return null;
        if (n.op === '+') return add(a, b);
        if (n.op === '-') return sub(a, b);
        if (n.op === '*') return mul(a, b);
        if (isConst(b)) { const k = constVal(b); return k === 0 ? null : scale(a, 1 / k); }
        return divExact(a, b);
      }
    }
    return null;
  }

  Alg.Poly = {
    gcd, create, addTerm, mono, constant, add, sub, neg, scale, mul, pow,
    degree, isConst, constVal, isMonomial, toPlain, evalAt, intContent, commonVars, fromAst, sortedTerms,
  };
})(typeof window !== 'undefined' ? window : globalThis);
