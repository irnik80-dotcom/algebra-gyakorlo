/* Algebra gyakorló — kifejezés-értelmező, kiértékelő és megjelenítő.
 * Támogatja: + - * / : ^ zárójel, implicit szorzás (3x, 2(x+1), (x+1)(x-1)),
 * ² ³ felső indexek, · × ÷ − jelek, tizedesvessző. */
(function (G) {
  'use strict';
  const Alg = (G.Alg = G.Alg || {});

  class ParseError extends Error {
    constructor(msg, pos) { super(msg); this.name = 'ParseError'; this.pos = pos; }
  }

  const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };

  function normalize(src) {
    const s = String(src);
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (SUP[ch] !== undefined) {
        let d = '';
        while (i < s.length && SUP[s[i]] !== undefined) { d += SUP[s[i]]; i++; }
        i--;
        out += '^' + d;
      } else if ('−–—'.includes(ch)) out += '-';
      else if ('·×⋅∙•'.includes(ch)) out += '*';
      else if (ch === '÷') out += ':';
      else if (ch === ',') out += '.';
      else if (ch === '[' || ch === '{') out += '(';
      else if (ch === ']' || ch === '}') out += ')';
      else out += ch;
    }
    return out;
  }

  function tokenize(src) {
    const s = normalize(src);
    const toks = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9.]/.test(ch)) {
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        const raw = s.slice(i, j);
        if (raw === '.' || (raw.match(/\./g) || []).length > 1) throw new ParseError('Hibás szám: „' + raw + '”', i);
        toks.push({ t: 'num', v: parseFloat(raw), pos: i });
        i = j; continue;
      }
      if (/[a-zA-Z]/.test(ch)) { toks.push({ t: 'var', v: ch.toLowerCase(), pos: i }); i++; continue; }
      if ('+-*/:^()'.includes(ch)) { toks.push({ t: ch, pos: i }); i++; continue; }
      if (ch === '=') throw new ParseError('Egyenlőségjelet ne írj — csak a végeredményt add meg.', i);
      throw new ParseError('Ismeretlen jel: „' + ch + '”', i);
    }
    toks.push({ t: 'end', pos: s.length });
    return toks;
  }

  function parse(src) {
    const toks = tokenize(src);
    let p = 0;
    const peek = () => toks[p];
    const next = () => toks[p++];

    function expr() {
      let node = term();
      while (peek().t === '+' || peek().t === '-') {
        const op = next().t;
        node = { type: 'op', op, a: node, b: term() };
      }
      return node;
    }
    function term() {
      let node = unary();
      for (;;) {
        const t = peek().t;
        if (t === '*' || t === '/' || t === ':') {
          next();
          node = { type: 'op', op: t, a: node, b: unary() };
        } else if (t === 'num' || t === 'var' || t === '(') {
          node = { type: 'op', op: '*', a: node, b: power(), implicit: true };
        } else break;
      }
      return node;
    }
    function unary() {
      const t = peek().t;
      if (t === '-') { next(); return { type: 'neg', a: unary() }; }
      if (t === '+') { next(); return unary(); }
      return power();
    }
    function expUnary() {
      const t = peek().t;
      if (t === '-') { next(); return { type: 'neg', a: expUnary() }; }
      if (t === '+') { next(); return expUnary(); }
      return power();
    }
    function power() {
      const base = primary();
      if (peek().t === '^') {
        next();
        if (peek().t === 'end') throw new ParseError('Hiányzik a kitevő a ^ után.', peek().pos);
        return { type: 'op', op: '^', a: base, b: expUnary() };
      }
      return base;
    }
    function primary() {
      const tk = peek();
      if (tk.t === 'num') { next(); return { type: 'num', v: tk.v }; }
      if (tk.t === 'var') { next(); return { type: 'var', n: tk.v }; }
      if (tk.t === '(') {
        next();
        if (peek().t === ')') throw new ParseError('Üres zárójel.', peek().pos);
        const e = expr();
        if (peek().t !== ')') throw new ParseError('Hiányzik egy záró zárójel.', peek().pos);
        next();
        return { type: 'paren', a: e };
      }
      if (tk.t === 'end') throw new ParseError('A kifejezés hiányos (valami hiányzik a végéről).', tk.pos);
      if (tk.t === ')') throw new ParseError('Felesleges záró zárójel.', tk.pos);
      throw new ParseError('Váratlan „' + tk.t + '” jel.', tk.pos);
    }

    if (peek().t === 'end') throw new ParseError('Üres kifejezés.', 0);
    const ast = expr();
    if (peek().t !== 'end') {
      const tk = peek();
      throw new ParseError(tk.t === ')' ? 'Felesleges záró zárójel.' : 'Váratlan „' + tk.t + '” jel.', tk.pos);
    }
    return ast;
  }

  function evaluate(n, env) {
    switch (n.type) {
      case 'num': return n.v;
      case 'var':
        if (!(n.n in env)) throw new Error('Ismeretlen változó: ' + n.n);
        return env[n.n];
      case 'paren': return evaluate(n.a, env);
      case 'neg': return -evaluate(n.a, env);
      case 'op': {
        const a = evaluate(n.a, env), b = evaluate(n.b, env);
        switch (n.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': case ':': return a / b;
          case '^': return Math.pow(a, b);
        }
      }
    }
    throw new Error('Ismeretlen csomópont');
  }

  function vars(n, set) {
    set = set || new Set();
    if (n.type === 'var') set.add(n.n);
    if (n.a) vars(n.a, set);
    if (n.b) vars(n.b, set);
    return [...set].sort();
  }

  // ---------- Megjelenítés HTML-ként ----------
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function fmtNum(v) {
    if (Number.isInteger(v)) return String(v);
    return String(+v.toFixed(6)).replace('.', ',');
  }
  const isDiv = n => n.type === 'op' && n.op === '/';
  const isParenDiv = n => n.type === 'paren' && isDiv(n.a);
  const strip = n => (n.type === 'paren' ? n.a : n);

  function firstAtom(n) {
    switch (n.type) {
      case 'num': return 'num';
      case 'var': return 'var';
      case 'neg': return 'neg';
      case 'paren': return isDiv(n.a) ? 'frac' : 'paren';
      case 'op':
        if (n.op === '/') return 'frac';
        if (n.op === '^' || n.op === '*') return firstAtom(n.a);
        return 'other';
    }
    return 'other';
  }
  function endsWithFrac(n) {
    if (isDiv(n) || isParenDiv(n)) return true;
    if (n.type === 'op' && n.op === '*') return endsWithFrac(n.b);
    return false;
  }

  function render(n, ctx) {
    switch (n.type) {
      case 'num': return fmtNum(n.v);
      case 'var': return '<var>' + esc(n.n) + '</var>';
      case 'paren':
        if (isDiv(n.a) && ctx !== 'base') return render(n.a);
        return '<span class="br">(</span>' + render(n.a) + '<span class="br">)</span>';
      case 'neg': return '−' + render(n.a);
      case 'op': {
        switch (n.op) {
          case '+': return render(n.a) + ' + ' + render(n.b);
          case '-': return render(n.a) + ' − ' + render(n.b);
          case ':': return render(n.a) + ' : ' + render(n.b);
          case '/':
            return '<span class="frac"><span class="fn">' + render(strip(n.a)) +
              '</span><span class="fd">' + render(strip(n.b)) + '</span></span>';
          case '^':
            return render(n.a, 'base') + '<sup>' + render(n.b) + '</sup>';
          case '*': {
            const fa = firstAtom(n.b);
            const dot = !n.implicit || fa === 'num' || fa === 'neg' || fa === 'frac' || endsWithFrac(n.a);
            return render(n.a) + (dot ? '·' : '') + render(n.b);
          }
        }
      }
    }
    return '';
  }

  function math(src) {
    try { return '<span class="math">' + render(parse(src)) + '</span>'; }
    catch (e) { return '<span class="math">' + esc(src) + '</span>'; }
  }

  Object.assign(Alg, { ParseError, normalize, tokenize, parse, evaluate, vars, render, math, esc, fmtNum });
})(typeof window !== 'undefined' ? window : globalThis);
