# Algebra gyakorló ✏️

Böngészőben futó matekgyakorló **algebrai kifejezésekhez** — a helyettesítési értéktől az algebrai törtek összeadásáig.
A feladatokat a program végtelen sok változatban generálja és **azonnal ellenőrzi**, a **Claude AI** pedig átnézi a diák levezetését, megmutatja az első hibát, tippet ad, vagy lépésenként elmagyarázza a megoldást.

Nem kell hozzá szerver, telepítés vagy fiók: egy statikus weboldal, ami **GitHub Pages**-en ingyen fut.

## Témakörök

**7. osztályos alapok**
1. Helyettesítési érték
2. Egynemű tagok összevonása
3. Zárójelfelbontás
4. Egytagúak szorzása, osztása, hatványozása
5. Többtagú szorzása egytagúval
6. Többtagúak szorzása
7. Kiemelés

**Továbblépés (8–9. osztály)**

8. Nevezetes azonosságok
9. Szorzattá alakítás azonosságokkal
10. Algebrai törtek egyszerűsítése
11. Algebrai törtek szorzása, osztása
12. Algebrai törtek összeadása, kivonása

Minden témakörben: rövid elmélet példákkal, **3 nehézségi szint**, végtelen számú véletlen feladat, pontszám és sorozatszámláló (a böngészőben tárolva).

## Hogyan ellenőriz?

**Automatikusan (AI nélkül is működik):**
- megnézi, hogy a beírt kifejezés **egyenlő-e** a helyes eredménnyel (bármilyen sorrendben, bármilyen helyes alakban írható),
- és hogy **megfelelő-e az alakja**: összevonta-e a tagokat, teljesen kiemelt-e, végig szorzattá alakította-e, egyszerűsítette-e a törtet. Ilyenkor nem csak „rossz”-at mond, hanem pl. „Majdnem! Az egyik zárójelben maradt még közös tényező.”
- Gépelés közben az **„Így értem:”** sor szépen szedve mutatja, hogyan értelmezte a beírást — így a zárójelezési hibák rögtön látszanak.

**AI-val (Claude):**
- **✦ AI ellenőrzés** — átnézi a levezetést lépésenként, megnevezi az első hibát és a megsértett szabályt, de a teljes megoldást nem árulja el.
- **Tipp** — egyetlen rövid segítség a következő lépéshez.
- **Lépésenkénti levezetés** — a „Megoldás” gomb után kérhető.
- **Saját feladat** fül — házi feladat ellenőrzése szövegesen vagy **a füzetről készült fotóval**.

## Közzététel GitHub Pages-en (kb. 5 perc)

1. GitHubon: **New repository** → név pl. `algebra-gyakorlo` → *Public* → **Create repository**.
2. **Add file → Upload files** → húzd be a mappa **teljes tartalmát** (`index.html`, `css/`, `js/`, `tests/`, `README.md` …) → **Commit changes**.
3. **Settings → Pages** → *Source*: **Deploy from a branch**, *Branch*: **main**, mappa: **/ (root)** → **Save**.
4. 1–2 perc múlva elérhető: `https://<felhasználónév>.github.io/algebra-gyakorlo/`

Git parancssorból:
```bash
cd algebra-gyakorlo
git init && git add . && git commit -m "Algebra gyakorló"
git branch -M main
git remote add origin https://github.com/<felhasználónév>/algebra-gyakorlo.git
git push -u origin main
```

Helyben is kipróbálható: elég duplán kattintani az `index.html`-re.

## Az AI beállítása

1. Hozz létre API-kulcsot: <https://console.anthropic.com/settings/keys> (egyenleg feltöltése szükséges).
2. Az oldalon jobb fent: **AI beállítása** → kulcs beillesztése → **Kapcsolat tesztelése** → **Mentés**.

**Biztonság:**
- A kulcs **nincs benne a kódban és a repóban** — csak annak a böngészőnek a `localStorage`-ában tárolódik, ahol beírtad, és csak az Anthropic API-nak (`api.anthropic.com`) küldjük el.
- Ezért a nyilvános GitHub-oldalt bárki használhatja, de AI-t csak az, aki saját kulcsot ad meg.
- Gyereknek: a szülő írja be a kulcsot a gyerek gépén/telefonján. A Console-ban állíts be **havi költségkeretet** (Settings → Limits).
- Közös gépen a beállításokban a **Kulcs törlése** gombbal eltávolítható.

**Költség:** egy ellenőrzés jellemzően néhány ezer token; az alapértelmezett *Sonnet* helyett az olcsóbb *Haiku* is választható a beállításokban.

## Gépelési súgó

| mit | hogyan |
|---|---|
| hatvány | `x^2` vagy `x²` |
| szorzás | `3x`, `2(x+1)`, `(x+1)(x-1)`, vagy `*` |
| tört | `(x+1)/(x-2)` — számláló és nevező zárójelben! |
| zárójel hatványa | `(x+3)^2` |

## Fejlesztőknek

```
index.html          az oldal
css/style.css       megjelenés (világos/sötét mód, mobil)
js/parser.js        kifejezés-értelmező, kiértékelő, HTML-szedés
js/poly.js          polinomműveletek
js/generators.js    a 12 témakör: elmélet + feladatgenerátorok
js/checker.js       egyenlőség- és alakellenőrzés
js/ai.js            Claude API-hívások, promptok
js/app.js           felület
tests/run-tests.js  tesztek (node tests/run-tests.js)
```

Nincs külső függőség és nincs build-lépés. A teszt minden témakör minden szintjén 400 feladatot generál, és ellenőrzi, hogy a program saját megoldása helyes és átmegy az ellenőrzőn.

Új témakör: a `js/generators.js` `topics` tömbjébe kell egy új elem (`id`, `group`, `title`, `short`, `theory()`, `gen(level)`).

## Licenc

MIT
