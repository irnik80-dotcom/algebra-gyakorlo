// Futtatás: node tests/run-tests.js
// Minden témakör minden szintjén sok feladatot generál, és ellenőrzi, hogy
// (1) a feladat és a megoldás értelmezhető, (2) egyenlőek, (3) a saját megoldás átmegy az ellenőrzőn.
'use strict';
const path = require('path');
for (const f of ['parser', 'poly', 'generators', 'checker']) require(path.join(__dirname, '..', 'js', f + '.js'));
const Alg = globalThis.Alg;

let fails = 0, runs = 0;
const fail = (...a) => { fails++; if (fails < 40) console.log('HIBA:', ...a); };

for (const t of Alg.topics) {
  for (const level of [1, 2, 3]) {
    for (let i = 0; i < 400; i++) {
      runs++;
      let p;
      try { p = t.gen(level); } catch (e) { fail(t.id, level, 'generátor:', e.message); continue; }
      let e, a;
      try { e = Alg.parse(p.expr); Alg.render(e); } catch (err) { fail(t.id, level, 'feladat:', p.expr, err.message); continue; }
      if (p.mode === 'number') {
        const v = Alg.evaluate(e, p.env);
        if (Math.abs(v - Number(p.answer)) > 1e-9) fail(t.id, level, 'érték', p.expr, p.answer);
      } else {
        try { a = Alg.parse(p.answer); Alg.render(a); } catch (err) { fail(t.id, level, 'megoldás:', p.answer, err.message); continue; }
        if (!Alg.equivalent(e, a)) fail(t.id, level, 'nem egyenlő:', p.expr, '≠', p.answer);
      }
      const r = Alg.check(p, p.answer);
      if (r.kind !== 'correct') fail(t.id, level, 'saját megoldás nem megy át:', p.expr, '→', p.answer, '|', r.msg);
      if (p.mode !== 'number' && Alg.check(p, p.expr).kind === 'correct' && p.expr.replace(/\s/g, '') !== p.answer.replace(/\s/g, ''))
        fail(t.id, level, 'a feladat maga elfogadott válasz lenne:', p.expr);
    }
  }
}

// Kézi esetek
const cases = [
  // [mód, feladat, helyes, beírás, várt kind]
  ['expanded', '3(2x-5)-4(x-1)', '2x - 11', '2x-11', 'correct'],
  ['expanded', '3(2x-5)-4(x-1)', '2x - 11', '-11+2x', 'correct'],
  ['expanded', '3(2x-5)-4(x-1)', '2x - 11', '6x-15-4x+4', 'form'],
  ['expanded', '3(2x-5)-4(x-1)', '2x - 11', '2x+11', 'wrong'],
  ['expanded', '(x+3)^2', 'x^2 + 6x + 9', 'x²+6x+9', 'correct'],
  ['expanded', '(x+3)^2', 'x^2 + 6x + 9', 'x·x+6x+9', 'form'],
  ['expanded', '(x+3)^2', 'x^2 + 6x + 9', 'x^2+9', 'wrong'],
  ['factored', '6x^3-9x^2', '3x^2(2x - 3)', '3x^2(2x-3)', 'correct'],
  ['factored', '6x^3-9x^2', '3x^2(2x - 3)', '3x(2x^2-3x)', 'form'],
  ['factored', '6x^3-9x^2', '3x^2(2x - 3)', '-3x^2(3-2x)', 'correct'],
  ['factored', '6x^3-9x^2', '3x^2(2x - 3)', '6x^3-9x^2', 'form'],
  ['factoredLinear', '2x^2-18', '2(x - 3)(x + 3)', '2(x-3)(x+3)', 'correct'],
  ['factoredLinear', '2x^2-18', '2(x - 3)(x + 3)', '2(x^2-9)', 'form'],
  ['factoredLinear', 'x^2+6x+9', '(x + 3)^2', '(x+3)(x+3)', 'correct'],
  ['factoredLinear', 'x^2+6x+9', '(x + 3)^2', '(x+3)^2', 'correct'],
];
for (const [mode, expr, answer, input, want] of cases) {
  const r = Alg.check({ mode, expr, answer }, input);
  if (r.kind !== want) fail('kézi eset', expr, input, 'várt:', want, 'kapott:', r.kind, r.msg);
}
const fr = { mode: 'fraction', expr: '(x^2-9)/(x^2+3x)', answer: '(x-3)/(x)', meta: { num: 'x - 3', den: 'x' } };
for (const [inp, want] of [['(x-3)/x', 'correct'], ['(x^2-9)/(x^2+3x)', 'form'], ['1-3/x', 'form'], ['(2x-6)/(2x)', 'form'], ['(x+3)/x', 'wrong']]) {
  const r = Alg.check(fr, inp);
  if (r.kind !== want) fail('tört', inp, 'várt:', want, 'kapott:', r.kind, r.msg);
}
const num = { mode: 'number', expr: '2x^2-3x+1', answer: '15', env: { x: -2 } };
for (const [inp, want] of [['15', 'correct'], ['8+6+1', 'form'], ['3', 'wrong'], ['x', 'form']]) {
  const r = Alg.check(num, inp);
  if (r.kind !== want) fail('szám', inp, 'várt:', want, 'kapott:', r.kind);
}
for (const bad of ['3x+', '(x+1', 'x+1)', '2x=4', '3 & x', '']) {
  const r = Alg.check({ mode: 'expanded', expr: 'x', answer: 'x' }, bad);
  if (!['syntax', 'empty'].includes(r.kind)) fail('szintaxis', bad, r.kind);
}

console.log(`${runs} generált feladat + kézi esetek — ${fails ? fails + ' HIBA' : 'minden rendben ✔'}`);
process.exit(fails ? 1 : 0);
