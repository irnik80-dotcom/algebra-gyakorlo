/* Algebra gyakorló — témakörök: elmélet + véletlen feladatgenerátorok (3 szinten).
 * Minden generátor ezt adja vissza:
 *   { expr, prompt, answer, mode, env?, meta? }
 *   expr   – a feladat kifejezése (a parser nyelvén)
 *   answer – a helyes végeredmény (a parser nyelvén)
 *   mode   – 'number' | 'expanded' | 'factored' | 'factoredLinear' | 'fraction'  */
(function (G) {
  'use strict';
  const Alg = G.Alg;
  const P = Alg.Poly;
  const m = s => Alg.math(s);

  // ---------- segédfüggvények ----------
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const rnz = (a, b) => { let v; do { v = ri(a, b); } while (v === 0); return v; };
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const coin = (p = 0.5) => Math.random() < p;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const gcd = P.gcd;
  const S = P.toPlain, M = P.mono, C = P.constant;
  const lin = (a, b, v = 'x') => P.add(M(a, { [v]: 1 }), C(b));
  const par = p => '(' + S(p) + ')';
  const sum = list => list.reduce((acc, p) => P.add(acc, p), P.create());
  const prod = list => list.reduce((acc, p) => P.mul(acc, p), C(1));
  const coefPre = k => (k === 1 ? '' : k === -1 ? '-' : String(k));
  const hu = n => (n < 0 ? '−' + (-n) : String(n));
  const KS = [-6, -5, -4, -3, -2, 2, 3, 4, 5, 6];
  function sumStr(items) {
    return items.map((s, i) => {
      s = s.trim();
      if (i === 0) return s;
      return s[0] === '-' ? ' - ' + s.slice(1) : ' + ' + s;
    }).join('');
  }
  function retry(fn, ok) {
    for (let i = 0; i < 500; i++) { const r = fn(); if (ok(r)) return r; }
    throw new Error('A feladatgenerátor nem talált megfelelő feladatot.');
  }

  // ---------- tényezős alak algebrai törtekhez ----------
  // part = { c, ex: Map(a -> kitevő) }  jelentése: c · Π (x + a)^kitevő   (a = 0 esetén x)
  function part(c, keys = []) {
    const ex = new Map();
    for (const k of keys) ex.set(k, (ex.get(k) || 0) + 1);
    return { c, ex };
  }
  const factorPoly = a => lin(1, a);
  function partPoly(pt) {
    let p = C(pt.c);
    for (const [a, e] of pt.ex) p = P.mul(p, P.pow(factorPoly(a), e));
    return p;
  }
  function partStr(pt) {
    const keys = [...pt.ex.keys()].sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : a - b));
    let body = '';
    for (const a of keys) {
      const e = pt.ex.get(a);
      body += (a === 0 ? 'x' : par(factorPoly(a))) + (e > 1 ? '^' + e : '');
    }
    if (!body) return String(pt.c);
    if (pt.c === 1) return body;
    if (pt.c === -1) return '-' + body;
    return pt.c + body;
  }
  function mulPart(p, q) {
    const ex = new Map(p.ex);
    for (const [k, e] of q.ex) ex.set(k, (ex.get(k) || 0) + e);
    return { c: p.c * q.c, ex };
  }
  const setEx = (pt, k, e) => { if (e > 0) pt.ex.set(k, e); else pt.ex.delete(k); };
  function reduceFrac(n0, d0) {
    const n = { c: n0.c, ex: new Map(n0.ex) }, d = { c: d0.c, ex: new Map(d0.ex) };
    for (const k of [...n.ex.keys()]) {
      if (d.ex.has(k)) {
        const mn = Math.min(n.ex.get(k), d.ex.get(k));
        setEx(n, k, n.ex.get(k) - mn);
        setEx(d, k, d.ex.get(k) - mn);
      }
    }
    const g = gcd(n.c, d.c) || 1;
    n.c /= g; d.c /= g;
    if (d.c < 0) { n.c = -n.c; d.c = -d.c; }
    return { n, d };
  }
  const isOne = pt => pt.c === 1 && pt.ex.size === 0;
  const frMul = (f, g) => reduceFrac(mulPart(f.n, g.n), mulPart(f.d, g.d));
  const frInv = f => reduceFrac(f.d, f.n);
  function fracAnswer(f) {
    const n = partStr(f.n);
    if (isOne(f.d)) return n;
    return '(' + n + ')/(' + partStr(f.d) + ')';
  }
  function fracWrapped(f) {
    const n = S(partPoly(f.n));
    if (isOne(f.d)) return '(' + n + ')';
    return '((' + n + ')/(' + S(partPoly(f.d)) + '))';
  }
  const fracMeta = f => ({ num: S(partPoly(f.n)), den: S(partPoly(f.d)) });
  const fracDegOk = (f, max = 3) => P.degree(partPoly(f.n)) <= max && P.degree(partPoly(f.d)) <= max;

  // =====================================================================
  const topics = [
    // 1 ------------------------------------------------------------------
    {
      id: 'behelyettesites', group: 'alap',
      title: 'Helyettesítési érték',
      short: 'A betűk helyére számokat írunk, és kiszámoljuk a kifejezés értékét.',
      theory: () => `
        <p>Az <b>algebrai kifejezésben</b> a betűk (változók) számokat jelölnek. A <b>helyettesítési érték</b> az a szám, amit akkor kapunk, ha a betűk helyére beírjuk a megadott számokat, és elvégezzük a műveleteket.</p>
        <ul>
          <li>Műveleti sorrend: zárójel → hatványozás → szorzás, osztás → összeadás, kivonás.</li>
          <li>Negatív számot behelyettesítéskor mindig tegyél <b>zárójelbe</b>!</li>
          <li>Vigyázz: ${m('(-3)^2')} = 9, de ${m('-3^2')} = −9.</li>
        </ul>
        <div class="example"><b>Példa:</b> ${m('2x^2 - 3x + 1')}, ha x = −2:<br>
        ${m('2*(-2)^2 - 3*(-2) + 1')} = ${m('2*4 + 6 + 1')} = 15</div>`,
      gen(level) {
        let p, env;
        if (level === 1) { p = lin(rnz(-6, 6), rnz(-9, 9)); env = { x: ri(1, 6) }; }
        else if (level === 2) { p = sum([M(rnz(-4, 4), { x: 2 }), M(rnz(-6, 6), { x: 1 }), C(rnz(-9, 9))]); env = { x: rnz(-4, 4) }; }
        else {
          p = sum([M(rnz(-3, 3), { x: 2 }), M(rnz(-5, 5), { x: 1, y: 1 }), M(rnz(-3, 3), { y: 2 }), C(rnz(-6, 6))]);
          env = { x: rnz(-3, 3), y: rnz(-3, 3) };
        }
        const expr = S(p);
        const val = Math.round(Alg.evaluate(Alg.parse(expr), env));
        const cond = Object.keys(env).map(k => `${k} = ${hu(env[k])}`).join(' és ');
        return { expr, prompt: `Számítsd ki a kifejezés helyettesítési értékét, ha ${cond}!`, answer: String(val), mode: 'number', env };
      },
    },

    // 2 ------------------------------------------------------------------
    {
      id: 'osszevonas', group: 'alap',
      title: 'Egynemű tagok összevonása',
      short: 'Csak az azonos betűrészű tagokat lehet összeadni.',
      theory: () => `
        <p>A kifejezés <b>tagjai</b> az összeadással, kivonással elválasztott részek. Egy tag számszorzója az <b>együttható</b>, a betűs része a <b>betűrész</b>.</p>
        <p><b>Egynemű</b> tagok: a betűrészük pontosan ugyanaz (ugyanazok a betűk, ugyanazokon a kitevőkön). Csak ezeket lehet összevonni: az együtthatókat összeadjuk, a betűrész változatlan marad.</p>
        <ul>
          <li>${m('5x')} és ${m('-2x')} egynemű → ${m('3x')}</li>
          <li>${m('x^2')} és ${m('x')} <b>nem</b> egynemű!</li>
          <li>${m('3xy')} és ${m('-yx')} egynemű (a betűk sorrendje nem számít).</li>
        </ul>
        <div class="example"><b>Példa:</b> ${m('3x + 5 - 7x + 2')} = ${m('-4x + 7')}</div>
        <p class="tip">Tipp: a tagot mindig az előtte álló előjellel együtt mozgasd!</p>`,
      gen(level) {
        const kindsBy = { 1: [{ x: 1 }, {}], 2: [{ x: 2 }, { x: 1 }, {}], 3: shuffle([{ x: 1 }, { y: 1 }, { x: 1, y: 1 }, { x: 2 }]).slice(0, 3) };
        const r = retry(() => {
          const terms = [];
          for (const v of kindsBy[level]) {
            const n = level === 1 ? ri(2, 3) : 2;
            for (let i = 0; i < n; i++) terms.push(M(rnz(-9, 9), v));
          }
          shuffle(terms);
          return { terms, res: sum(terms) };
        }, r => r.res.size >= 1);
        return {
          expr: sumStr(r.terms.map(S)), prompt: 'Vond össze az egynemű tagokat!',
          answer: S(r.res), mode: 'expanded',
        };
      },
    },

    // 3 ------------------------------------------------------------------
    {
      id: 'zarojel', group: 'alap',
      title: 'Zárójelfelbontás',
      short: 'A zárójel előtti szorzóval a zárójel minden tagját megszorozzuk.',
      theory: () => `
        <p>Ha zárójel előtt szorzó áll, a zárójel <b>minden tagját</b> megszorozzuk vele: ${m('a(b + c)')} = ${m('ab + ac')}.</p>
        <ul>
          <li>Előjelszabály: (+)·(+) = +, (−)·(−) = +, (+)·(−) = −.</li>
          <li>Ha mínusz áll a zárójel előtt, minden tag előjele megfordul: ${m('-(a - b)')} = ${m('-a + b')}.</li>
        </ul>
        <div class="example"><b>Példa:</b> ${m('3(2x - 5) - 4(x - 1)')} = ${m('6x - 15 - 4x + 4')} = ${m('2x - 11')}</div>`,
      gen(level) {
        const items = [];
        let res = P.create();
        const group = (k, p) => { items.push(coefPre(k) + par(p)); res = P.add(res, P.scale(p, k)); };
        if (level === 1) group(pick(KS), lin(rnz(-7, 7), rnz(-9, 9)));
        else if (level === 2) { group(pick(KS), lin(rnz(-7, 7), rnz(-9, 9))); group(pick(KS), lin(rnz(-7, 7), rnz(-9, 9))); }
        else {
          const t0 = M(rnz(-6, 6), { x: 1 });
          items.push(S(t0)); res = P.add(res, t0);
          group(pick(KS), P.add(M(rnz(-3, 3), { x: 2 }), lin(rnz(-5, 5), rnz(-6, 6))));
          group(pick([1, -1]), lin(rnz(-5, 5), rnz(-7, 7)));
        }
        if (res.size === 0) return this.gen(level);
        return { expr: sumStr(items), prompt: 'Bontsd fel a zárójeleket, és vond össze az egynemű tagokat!', answer: S(res), mode: 'expanded' };
      },
    },

    // 4 ------------------------------------------------------------------
    {
      id: 'egytaguak', group: 'alap',
      title: 'Egytagúak szorzása, osztása, hatványozása',
      short: 'Együtthatók külön, betűk külön — a kitevőkre a hatványozás azonosságai érvényesek.',
      theory: () => `
        <p>Egytagú kifejezéseknél az együtthatókkal és a betűkkel külön számolunk. Azonos alapú hatványokra:</p>
        <ul>
          <li>szorzás: <span class="math"><var>x</var><sup>m</sup> · <var>x</var><sup>n</sup> = <var>x</var><sup>m+n</sup></span> (a kitevők összeadódnak)</li>
          <li>osztás: <span class="math"><var>x</var><sup>m</sup> : <var>x</var><sup>n</sup> = <var>x</var><sup>m−n</sup></span></li>
          <li>hatvány hatványa: <span class="math">(<var>x</var><sup>m</sup>)<sup>n</sup> = <var>x</var><sup>m·n</sup></span></li>
          <li>szorzat hatványa: <span class="math">(<var>a</var><var>b</var>)<sup>n</sup> = <var>a</var><sup>n</sup><var>b</var><sup>n</sup></span> — az együtthatót is hatványozni kell!</li>
        </ul>
        <div class="example"><b>Példák:</b><br>
          ${m('(3x^2y)*(-4xy^3)')} = ${m('-12x^3y^4')}<br>
          ${m('(12x^5):(3x^2)')} = ${m('4x^3')}<br>
          ${m('(-2x^2y)^3')} = ${m('-8x^6y^3')}</div>`,
      gen(level) {
        const rm = (neg, withY) => {
          const v = { x: ri(1, 3) };
          if (withY && coin(0.7)) v.y = ri(1, 3);
          return M(neg ? rnz(-6, 6) : ri(1, 6), v);
        };
        let expr, res;
        if (level < 3) {
          const neg = level === 2, wy = level === 2;
          if (coin(0.6)) {
            const n = level === 2 && coin(0.4) ? 3 : 2;
            const ms = Array.from({ length: n }, () => rm(neg, wy));
            expr = ms.map(par).join(' * ');
            res = prod(ms);
          } else {
            const q = rm(neg, wy);
            const d = M(neg ? pick(KS) : ri(2, 5), wy && coin() ? { x: ri(1, 2), y: 1 } : { x: ri(1, 3) });
            expr = par(P.mul(q, d)) + ' : ' + par(d);
            res = q;
          }
        } else {
          const b = M(pick([-3, -2, 2, 3]), coin() ? { x: ri(1, 3), y: ri(1, 2) } : { x: ri(1, 3) });
          const k = b.values().next().value.c === 3 || b.values().next().value.c === -3 ? 2 : ri(2, 3);
          const other = rm(true, true);
          expr = par(b) + '^' + k + ' * ' + par(other);
          res = P.mul(P.pow(b, k), other);
        }
        return { expr, prompt: 'Végezd el a műveleteket! Az eredményt egyetlen egytagú kifejezésként add meg.', answer: S(res), mode: 'expanded' };
      },
    },

    // 5 ------------------------------------------------------------------
    {
      id: 'szorzas_egytagu', group: 'alap',
      title: 'Többtagú szorzása egytagúval',
      short: 'Az egytagúval a zárójel minden tagját megszorozzuk.',
      theory: () => `
        <p>Az egytagúval a többtagú kifejezés <b>minden tagját</b> megszorozzuk, majd összevonjuk az egynemű tagokat (ha vannak).</p>
        <div class="example"><b>Példa:</b> ${m('-3x(2x^2 - 5x + 1)')} = ${m('-6x^3 + 15x^2 - 3x')}</div>
        <p class="tip">Tipp: minden egyes szorzásnál három dologra figyelj: <b>előjel</b>, <b>együttható</b>, <b>kitevő</b>.</p>`,
      gen(level) {
        let g, p;
        if (level === 1) { g = M(rnz(-5, 5), { x: 1 }); p = lin(rnz(-6, 6), rnz(-9, 9)); }
        else if (level === 2) { g = M(rnz(-5, 5), { x: ri(1, 2) }); p = sum([M(rnz(-4, 4), { x: 2 }), M(rnz(-6, 6), { x: 1 }), C(rnz(-9, 9))]); }
        else { g = M(rnz(-4, 4), { x: ri(1, 2), y: 1 }); p = sum([M(rnz(-4, 4), { x: 2 }), M(rnz(-5, 5), { x: 1, y: 1 }), M(rnz(-6, 6), { y: 1 })]); }
        return { expr: S(g) + par(p), prompt: 'Végezd el a szorzást!', answer: S(P.mul(g, p)), mode: 'expanded' };
      },
    },

    // 6 ------------------------------------------------------------------
    {
      id: 'szorzas_tobbtagu', group: 'alap',
      title: 'Többtagúak szorzása',
      short: 'Mindenkit mindenkivel: az egyik zárójel minden tagját a másik minden tagjával.',
      theory: () => `
        <p>Két többtagú kifejezés szorzásakor az egyik <b>minden tagját</b> megszorozzuk a másik <b>minden tagjával</b>, majd összevonunk:</p>
        <p>${m('(a + b)(c + d)')} = ${m('ac + ad + bc + bd')}</p>
        <div class="example"><b>Példa:</b> ${m('(x + 3)(x - 5)')} = ${m('x^2 - 5x + 3x - 15')} = ${m('x^2 - 2x - 15')}</div>
        <p class="tip">Ellenőrzés: 2 tag · 2 tag = 4 szorzat az összevonás előtt.</p>`,
      gen(level) {
        let fs;
        if (level === 1) fs = [lin(1, rnz(-9, 9)), lin(1, rnz(-9, 9))];
        else if (level === 2) {
          fs = coin()
            ? [lin(rnz(-5, 5), rnz(-7, 7)), lin(rnz(-5, 5), rnz(-7, 7))]
            : [lin(1, rnz(-6, 6)), sum([M(rnz(-3, 3), { x: 2 }), M(rnz(-5, 5), { x: 1 }), C(rnz(-6, 6))])];
        } else {
          fs = coin()
            ? [P.add(M(rnz(-4, 4), { x: 1 }), M(rnz(-4, 4), { y: 1 })), P.add(M(rnz(-4, 4), { x: 1 }), M(rnz(-4, 4), { y: 1 }))]
            : [lin(1, rnz(-4, 4)), lin(1, rnz(-4, 4)), lin(1, rnz(-4, 4))];
        }
        return { expr: fs.map(par).join(''), prompt: 'Végezd el a szorzást, és vond össze az egynemű tagokat!', answer: S(prod(fs)), mode: 'expanded' };
      },
    },

    // 7 ------------------------------------------------------------------
    {
      id: 'nevezetes', group: 'halado',
      title: 'Nevezetes azonosságok',
      short: '(a + b)², (a − b)², (a + b)(a − b) — gyorsan és hibátlanul.',
      theory: () => `
        <ul>
          <li>${m('(a + b)^2')} = ${m('a^2 + 2ab + b^2')}</li>
          <li>${m('(a - b)^2')} = ${m('a^2 - 2ab + b^2')}</li>
          <li>${m('(a + b)(a - b)')} = ${m('a^2 - b^2')}</li>
          <li>${m('(a + b)^3')} = ${m('a^3 + 3a^2b + 3ab^2 + b^3')}</li>
        </ul>
        <div class="example"><b>Példa:</b> ${m('(2x - 3)^2')} = ${m('(2x)^2 - 2*2x*3 + 3^2')} = ${m('4x^2 - 12x + 9')}</div>
        <p class="warn">Gyakori hiba: ${m('(x + 3)^2')} ≠ ${m('x^2 + 9')} — a középső tag (6x) nem maradhat ki!</p>`,
      gen(level) {
        let expr, res;
        const sq = f => { expr = par(f) + '^2'; res = P.pow(f, 2); };
        const diff = (f1, f2) => { const fs = shuffle([f1, f2]); expr = fs.map(par).join(''); res = P.mul(f1, f2); };
        if (level < 3) {
          const k = level === 1 ? 1 : ri(2, 5), a = ri(1, 9);
          const t = pick(['p', 'm', 'd']);
          if (t === 'p') sq(lin(k, a)); else if (t === 'm') sq(lin(k, -a)); else diff(lin(k, a), lin(k, -a));
        } else {
          const t = pick(['xy', 'x2', 'cube']);
          if (t === 'xy') sq(P.add(M(ri(1, 4), { x: 1 }), M(pick([-1, 1]) * ri(1, 4), { y: 1 })));
          else if (t === 'x2') { const a = ri(1, 3), b = ri(1, 9); diff(P.add(M(a, { x: 2 }), C(b)), P.add(M(a, { x: 2 }), C(-b))); }
          else { const f = lin(1, pick([-1, 1]) * ri(1, 3)); expr = par(f) + '^3'; res = P.pow(f, 3); }
        }
        return { expr, prompt: 'Bontsd fel a zárójelet a nevezetes azonosság segítségével!', answer: S(res), mode: 'expanded' };
      },
    },

    // 8 ------------------------------------------------------------------
    {
      id: 'kiemeles', group: 'alap',
      title: 'Kiemelés',
      short: 'A közös szorzótényezőt a zárójel elé írjuk — a zárójelfelbontás visszafelé.',
      theory: () => `
        <p><b>Kiemelés</b>: a tagok közös szorzótényezőjét a zárójel elé írjuk. Ez a zárójelfelbontás „visszafelé”.</p>
        <ul>
          <li>Számból: az együtthatók <b>legnagyobb közös osztója</b>.</li>
          <li>Betűből: a mindegyik tagban szereplő betűk, a <b>legkisebb</b> kitevőn.</li>
          <li>A zárójelbe az kerül, amivel visszaszorozva az eredeti tagokat kapjuk.</li>
        </ul>
        <div class="example"><b>Példa:</b> ${m('6x^3 - 9x^2')} = ${m('3x^2(2x - 3)')}</div>
        <p class="tip">Ellenőrizd visszaszorzással! A zárójelben maradt tagoknak már ne legyen közös osztójuk.</p>`,
      gen(level) {
        const kinds = { 1: [{ x: 1 }, {}], 2: [{ x: 2 }, { x: 1 }, {}], 3: [{ x: 2 }, { x: 1, y: 1 }, { y: 1 }, { x: 1 }, {}] };
        const r = retry(() => {
          let g;
          if (level === 1) g = coin(0.6) ? C(ri(2, 9)) : M(ri(1, 4), { x: 1 });
          else if (level === 2) g = M(ri(2, 6), { x: ri(1, 2) });
          else g = M(pick([2, 3, 4, 5, -2, -3]), { x: ri(1, 2), y: ri(1, 2) });
          const ks = shuffle(kinds[level].slice()).slice(0, level === 1 ? 2 : ri(2, 3));
          const p = sum(ks.map(v => M(rnz(-7, 7), v)));
          return { g, p };
        }, ({ g, p }) => p.size >= 2 && P.intContent(p) === 1 && Object.keys(P.commonVars(p)).length === 0
          && !(P.isConst(g) && Math.abs(P.constVal(g)) === 1) && P.sortedTerms(p)[0].c > 0);
        return {
          expr: S(P.mul(r.g, r.p)),
          prompt: 'Alakítsd szorzattá kiemeléssel! Emelj ki mindent, amit lehet.',
          answer: S(r.g) + par(r.p), mode: 'factored',
        };
      },
    },

    // 9 ------------------------------------------------------------------
    {
      id: 'szorzatta', group: 'halado',
      title: 'Szorzattá alakítás azonosságokkal',
      short: 'Kiemelés, nevezetes azonosságok visszafelé, másodfokú háromtagúak.',
      theory: () => `
        <p>Szorzattá alakításkor nézd meg sorban:</p>
        <ol>
          <li>Lehet-e <b>kiemelni</b>?</li>
          <li>Felismerhető-e egy <b>nevezetes azonosság</b>?
            <ul>
              <li>${m('a^2 - b^2')} = ${m('(a - b)(a + b)')}</li>
              <li>${m('a^2 + 2ab + b^2')} = ${m('(a + b)^2')}</li>
              <li>${m('a^2 - 2ab + b^2')} = ${m('(a - b)^2')}</li>
            </ul></li>
          <li>${m('x^2 + px + q')} alak: keress két számot, amelyek <b>szorzata q</b> és <b>összege p</b>.</li>
        </ol>
        <div class="example"><b>Példák:</b><br>
          ${m('2x^2 - 18')} = ${m('2(x^2 - 9)')} = ${m('2(x - 3)(x + 3)')}<br>
          ${m('x^2 + 5x + 6')} = ${m('(x + 2)(x + 3)')} &nbsp;(2·3 = 6, 2 + 3 = 5)</div>`,
      gen(level) {
        let fs, ans;
        const sgn = pick([1, -1]);
        if (level === 1) {
          const a = ri(1, 9);
          if (coin()) { fs = [lin(1, -a), lin(1, a)]; ans = par(fs[0]) + par(fs[1]); }
          else { fs = [lin(1, sgn * a), lin(1, sgn * a)]; ans = par(fs[0]) + '^2'; }
        } else if (level === 2) {
          let k, a;
          do { k = ri(2, 5); a = ri(1, 9); } while (gcd(k, a) !== 1);
          if (coin()) { fs = [lin(k, -a), lin(k, a)]; ans = par(fs[0]) + par(fs[1]); }
          else { fs = [lin(k, sgn * a), lin(k, sgn * a)]; ans = par(fs[0]) + '^2'; }
        } else {
          const t = pick(['cd', 'cs', 'xd', 'tri', 'tri']);
          const a = ri(1, 6), c = ri(2, 5);
          if (t === 'cd') { fs = [C(c), lin(1, -a), lin(1, a)]; ans = c + par(fs[1]) + par(fs[2]); }
          else if (t === 'cs') { const f = lin(1, sgn * a); fs = [C(c), f, f]; ans = c + par(f) + '^2'; }
          else if (t === 'xd') { fs = [M(1, { x: 1 }), lin(1, -a), lin(1, a)]; ans = 'x' + par(fs[1]) + par(fs[2]); }
          else {
            let r1, r2;
            do { r1 = rnz(-6, 6); r2 = rnz(-6, 6); } while (r1 === r2 || r1 === -r2);
            fs = [lin(1, -r1), lin(1, -r2)]; ans = par(fs[0]) + par(fs[1]);
          }
        }
        return {
          expr: S(prod(fs)), prompt: 'Alakítsd szorzattá! (Ha lehet, előbb emelj ki, aztán keress nevezetes azonosságot.)',
          answer: ans, mode: 'factoredLinear',
        };
      },
    },

    // 10 -----------------------------------------------------------------
    {
      id: 'tort_egyszerusites', group: 'halado',
      title: 'Algebrai törtek egyszerűsítése',
      short: 'Szorzattá alakítás, majd egyszerűsítés a közös tényezőkkel.',
      theory: () => `
        <p>Algebrai törtet úgy egyszerűsítünk, hogy a számlálót és a nevezőt <b>szorzattá alakítjuk</b>, majd a közös <b>tényezőkkel</b> osztunk.</p>
        <p class="warn">Csak szorzótényezővel lehet egyszerűsíteni, taggal nem! ${m('(x + 3)/(x)')} ≠ 3</p>
        <div class="example"><b>Példa:</b> ${m('(x^2 - 9)/(x^2 + 3x)')} = ${m('((x - 3)(x + 3))/(x(x + 3))')} = ${m('(x - 3)/(x)')}</div>
        <p class="tip">Kikötés: a nevező nem lehet 0, itt x ≠ 0 és x ≠ −3. (A gyakorlóban csak az eredményt kell beírni.)</p>`,
      gen(level) {
        const r = retry(() => {
          let Gc, Gk = [], nk, dk;
          if (level === 1) {
            Gc = ri(2, 6); const a = rnz(-9, 9);
            [nk, dk] = pick([[[a], [0]], [[0], [a]], [[a], []]]);
          } else if (level === 2) {
            Gc = pick([1, 1, 2, 3]); Gk = [rnz(-7, 7)];
            const opt = () => pick([[], [0], [rnz(-7, 7)]]);
            nk = opt(); dk = opt();
          } else {
            Gc = pick([2, 3, 4]); const a = rnz(-6, 6);
            Gk = coin() ? [a] : [0, a];
            nk = pick([[a], [rnz(-6, 6)], [0], []]);
            dk = pick([[-a], [rnz(-6, 6)], [0], []]);
          }
          let c1 = ri(1, 5), c2 = ri(1, 5);
          if (gcd(c1, c2) !== 1) c2 = 1;
          if (coin(0.2)) c1 = -c1;
          const num = part(Gc * c1, [...Gk, ...nk]), den = part(Gc * c2, [...Gk, ...dk]);
          return { num, den, nk, dk };
        }, r => !r.nk.some(k => r.dk.includes(k)) && (r.nk.length + r.dk.length > 0)
          && P.degree(partPoly(r.num)) <= 3 && P.degree(partPoly(r.den)) <= 3 && partPoly(r.den).size >= 1);
        const red = reduceFrac(r.num, r.den);
        return {
          expr: '(' + S(partPoly(r.num)) + ')/(' + S(partPoly(r.den)) + ')',
          prompt: 'Egyszerűsítsd a törtet! (Először alakítsd szorzattá a számlálót és a nevezőt.)',
          answer: fracAnswer(red), mode: 'fraction', meta: fracMeta(red),
        };
      },
    },

    // 11 -----------------------------------------------------------------
    {
      id: 'tort_szorzas', group: 'halado',
      title: 'Algebrai törtek szorzása, osztása',
      short: 'Bontsd tényezőkre, egyszerűsíts keresztben, osztásnál szorozz a reciprokkal.',
      theory: () => `
        <p><b>Szorzás:</b> számlálót a számlálóval, nevezőt a nevezővel szorzunk — de előtte érdemes mindent szorzattá alakítani és <b>keresztben egyszerűsíteni</b>: ${m('((a)/(b))*((c)/(d))')} = ${m('(ac)/(bd)')}</p>
        <p><b>Osztás:</b> az osztó reciprokával szorzunk: ${m('((a)/(b)):((c)/(d))')} = ${m('((a)/(b))*((d)/(c))')}</p>
        <div class="example"><b>Példa:</b> ${m('((x^2 - 4)/(3x))*((6x^2)/(x + 2))')} = ${m('(((x - 2)(x + 2))/(3x))*((6x^2)/(x + 2))')} = ${m('2x(x - 2)')}</div>`,
      gen(level) {
        const cs = () => ri(1, 6);
        const r = retry(() => {
          let Gp, A, B, Cc, D;
          if (level === 1) {
            const xk = () => Array(ri(0, 2)).fill(0);
            Gp = part(ri(2, 4), Array(ri(1, 2)).fill(0));
            A = part(cs(), xk()); B = part(cs(), xk()); Cc = part(cs(), xk()); D = part(cs(), xk());
          } else {
            const a = rnz(-6, 6);
            Gp = part(pick([1, 1, 2, 3]), [a]);
            if (level === 3 && coin()) Gp.ex.set(0, 1);
            const k = () => pick([[], [0], [rnz(-6, 6)]]);
            A = part(cs(), k()); B = part(cs(), k()); Cc = part(cs(), k()); D = part(cs(), k());
          }
          const F1 = reduceFrac(mulPart(A, Gp), B), F2 = reduceFrac(Cc, mulPart(D, Gp));
          return { F1, F2, Gp, res: frMul(F1, F2) };
        }, r => fracDegOk(r.F1) && fracDegOk(r.F2) && fracDegOk(r.res)
          && [...r.Gp.ex.keys()].every(k => r.F1.n.ex.has(k) && r.F2.d.ex.has(k))
          && !isOne(r.F2.d) && !(isOne(r.F1.d) && r.F1.n.ex.size === 0)
          && !(isOne(r.F1.d) && isOne(r.F2.d)) && (r.res.n.ex.size + r.res.d.ex.size > 0));
        const div = (level === 3 && coin(0.6)) || (level === 2 && coin(0.3));
        let expr, prompt;
        if (div) {
          const F2d = frInv(r.F2);
          expr = fracWrapped(r.F1) + ' : ' + fracWrapped(F2d);
          prompt = 'Végezd el az osztást, és egyszerűsítsd az eredményt!';
        } else {
          expr = fracWrapped(r.F1) + ' * ' + fracWrapped(r.F2);
          prompt = 'Végezd el a szorzást, és egyszerűsítsd az eredményt!';
        }
        return { expr, prompt, answer: fracAnswer(r.res), mode: 'fraction', meta: fracMeta(r.res) };
      },
    },

    // 12 -----------------------------------------------------------------
    {
      id: 'tort_osszeadas', group: 'halado',
      title: 'Algebrai törtek összeadása, kivonása',
      short: 'Közös nevező, bővítés, a számlálók összevonása.',
      theory: () => `
        <p>Összeadni és kivonni csak <b>közös nevezőjű</b> törteket tudunk: a számlálókat összeadjuk, a nevező marad.</p>
        <ol>
          <li>Alakítsd szorzattá a nevezőket.</li>
          <li>Keresd meg a legkisebb közös nevezőt.</li>
          <li>Bővítsd a törteket, majd vond össze a számlálókat.</li>
        </ol>
        <p class="warn">Kivonásnál a második számlálót tedd zárójelbe, mert a mínusz minden tagjára vonatkozik!</p>
        <div class="example"><b>Példa:</b> ${m('(2)/(x + 1) + (3)/(x - 2)')} = ${m('(2(x - 2) + 3(x + 1))/((x + 1)(x - 2))')} = ${m('(5x - 1)/((x + 1)(x - 2))')}</div>`,
      gen(level) {
        const r = retry(() => {
          const p = rnz(-7, 7), q = rnz(-7, 7), op = pick(['+', '-']), s = op === '+' ? 1 : -1;
          let expr, num, den, denStr;
          if (level === 1) {
            den = lin(1, p);
            const n1 = lin(rnz(-5, 5), rnz(-9, 9)), n2 = lin(rnz(-5, 5), rnz(-9, 9));
            num = P.add(n1, P.scale(n2, s));
            expr = `(${S(n1)})/(${S(den)}) ${op} (${S(n2)})/(${S(den)})`;
            denStr = S(den);
            return { expr, num, den, denStr, roots: [-p], p, q: p };
          }
          const a = rnz(-6, 6);
          if (level === 2) {
            const b = rnz(-6, 6);
            den = P.mul(lin(1, p), lin(1, q));
            num = P.add(P.scale(lin(1, q), a), P.scale(lin(1, p), s * b));
            expr = `(${a})/(${S(lin(1, p))}) ${op} (${b})/(${S(lin(1, q))})`;
          } else {
            const n2 = coin() ? C(rnz(-9, 9)) : lin(rnz(-3, 3), rnz(-9, 9));
            den = P.mul(lin(1, p), lin(1, q));
            num = P.add(P.scale(lin(1, q), a), P.scale(n2, s));
            expr = `(${a})/(${S(lin(1, p))}) ${op} (${S(n2)})/(${S(den)})`;
          }
          denStr = par(lin(1, p)) + par(lin(1, q));
          return { expr, num, den, denStr, roots: [-p, -q], p, q };
        }, r => r.num.size > 0 && (level === 1 || r.p !== r.q)
          && r.roots.every(x0 => Math.abs(P.evalAt(r.num, { x: x0 })) > 1e-9));
        return {
          expr: r.expr,
          prompt: 'Végezd el a műveletet! Az eredményt egyetlen törtként add meg, a lehető legegyszerűbb alakban.',
          answer: '(' + S(r.num) + ')/(' + r.denStr + ')', mode: 'fraction',
          meta: { num: S(r.num), den: S(r.den) },
        };
      },
    },
  ];

  // az alap témakörök elöl, utánuk a haladók (a tömbön belüli sorrend megmarad)
  Alg.topics = [...topics.filter(t => t.group === 'alap'), ...topics.filter(t => t.group === 'halado')];
  Alg.groups = { alap: '7. osztályos alapok', halado: 'Továbblépés (8–9. osztály)' };
})(typeof window !== 'undefined' ? window : globalThis);
