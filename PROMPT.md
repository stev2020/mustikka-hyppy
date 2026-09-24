# Prompt: Mustikka Hyppy – Vokabel-Sprungspiel

## Aufgabe
Baue ein Browserspiel im Stil von Doodle Jump als Vokabeltrainer (zuerst
Deutsch → Finnisch). Es ist zunächst ein eigenständiges Testspiel, wird
später in eine Lern-App eingebettet und soll per Capacitor auch als
Android-App laufen. Alle Grafiken liegen fertig im Ordner `assets/`
(siehe unten), bitte keine eigenen Grafiken erfinden.

## Spielprinzip
- Die Spielfigur (eine Heidelbeere) springt automatisch; der Spieler
  steuert nur links/rechts. Wer seitlich aus dem Bild läuft, erscheint
  auf der anderen Seite.
- Oben am Bildschirm steht ein deutsches Wort bzw. eine Wendung.
- Das Level besteht aus neutralen Plattformen (ohne Text) und in
  regelmäßigen Abständen (ca. alle 6–7 Plattformen) aus "Wortreihen" mit
  2–4 Plattformen. In jeder Wortreihe ist genau eine Plattform die
  richtige finnische Übersetzung des oben angezeigten Wortes.
- Richtige Plattform: normaler Sprung, Punkte, die Plattform leuchtet
  kurz grün, oben erscheint das Wort für die nächste Reihe.
- Falsche Plattform: bricht mit Holzsplitter-Partikeln, der Spieler
  verliert ein Herz (3 Herzen), die richtige Plattform leuchtet kurz auf,
  damit der Spieler die Lösung sieht.
- Unter den unteren Bildschirmrand fallen = Game Over.
- Jede Wortreihe muss von der vorherigen Plattform aus garantiert
  erreichbar sein; alle Optionen einer Reihe müssen gleich gut erreichbar
  sein.
- Die erste Wortreihe liegt so, dass sie beim Start nicht unter der
  Anzeige oben verschwindet (mindestens 250 px unter dem oberen Rand).

## Tempo-Einstellung (3 Stufen)
- Im Startbildschirm und im Pausenmenü wählbar: **Langsam / Normal /
  Schnell**. Standard: Normal. Die Wahl wird lokal gespeichert und kann
  von außen per Konfiguration gesetzt werden (`tempo: "slow" | "normal"
  | "fast"`).
- Die Stufe ändert nur die Geschwindigkeit, nicht die Geometrie: Die
  Sprunghöhe bleibt immer gleich (max. 230 px bei 720×1280), damit die
  Level-Erzeugung und die Erreichbarkeit unabhängig vom Tempo sind.
- Vorgabe über die Flugzeit eines Sprungs (Absprung bis Rückkehr auf
  dieselbe Höhe): Langsam 1,2 s, Normal 0,95 s, Schnell 0,75 s.
  Daraus: Schwerkraft g = 8·h/T², Absprunggeschwindigkeit v0 = 4·h/T.
  Die maximale Seitwärtsgeschwindigkeit skaliert mit 1/T, damit die
  seitliche Reichweite pro Sprung gleich bleibt.
- Die Schwierigkeitssteigerung mit der Höhe darf das Tempo höchstens um
  15 % gegenüber der gewählten Stufe erhöhen.

## Vokabeldaten
- Vokabeln liegen in JSON-Dateien, sprachneutral aufgebaut; kein
  Vokabular im Spielcode:
  ```json
  {
    "id": "koira-nom",
    "source": "der Hund",
    "target": "koira",
    "lemma": "koira",
    "form": "nominativ",
    "category": "tiere",
    "level": 1,
    "distractors": ["kissa", "koiran", "koirat"]
  }
  ```
- Einträge können Grundwörter oder bestimmte Grammatikformen abfragen
  (z. B. "im Haus" → "talossa").
- Ablenker: zuerst die handverlesenen aus `distractors`; wenn nicht genug
  da sind, automatisch aus derselben Kategorie/demselben Level bzw.
  andere Formen desselben Lemmas.
- Sprache und Richtung (DE→FI, später FI→DE und andere Sprachen) sind
  Einstellungen, nicht fest verdrahtet.
- Falsch beantwortete Wörter kommen in derselben Runde nach einigen
  Reihen erneut.
- Eine Beispieldatei mit ca. 30 finnischen Grundwörtern plus einigen
  Grammatikformen liegt bei.

## Schwierigkeit
- Steigt mit der Höhe: mehr Optionen pro Reihe (2 → 4), ähnlichere
  Ablenker (erst andere Kategorie, dann gleiche Kategorie, dann andere
  Formen desselben Wortes), leicht höheres Tempo (siehe Tempo-Grenze).
- Das Tempo muss immer genug Lesezeit lassen, auch bei langen Wörtern
  wie "lentokenttä".

## Grafik und Welten
Alle Maße beziehen sich auf die Design-Auflösung **720×1280 (Hochformat)**;
das Spiel skaliert auf andere Bildschirme und HiDPI. "Höhe" meint im
Folgenden die Kletterhöhe in Design-Pixeln (Start = 0).

### Figur (`assets/character/`)
- `berry_idle.png`, `berry_jump.png`, `berry_land.png`, `berry_hurt.png`,
  je 512×512, transparent. Alle Posen sind unten ausgerichtet: Die
  Unterkante der Figur liegt bei y = 450, horizontal mittig.
  Ursprung/Anker also (0.5, 450/512).
- Darstellungshöhe im Spiel ca. 100 px.
- Posen: `land` kurz beim Aufsetzen (Stauchen), `jump` in der
  Aufwärtsphase, `idle` im Fallen/Scheitelpunkt, `hurt` bei falscher
  Plattform. Zusätzlich leichtes Squash & Stretch per Skalierung.

### Plattformen (`assets/platforms/`)
- `plank_word.png` (890×226): dicke Holzplanke ohne Schnee für
  Wortplattformen. Als 9-Slice verwenden (links/rechts je ca. 90 px
  fest, Mitte dehnbar), Breite passt sich der Wortlänge an (min. ca.
  170 px im Spiel). Schrift: fett, hell (#FFF6E1) mit dunkler Kontur
  (#32190E), gut lesbar, ä und ö müssen sauber dargestellt werden.
- `plank_snow.png` (894×153): dünne verschneite Planke für neutrale
  Plattformen, im Spiel ca. 150 px breit.
- Richtige Planke: grünes Glühen dahinter. Falsche: Holzsplitter-Partikel.

### Hintergrund-Welten (Parallax)
Jede Welt besteht aus Ebenen mit einem Parallax-Faktor f: Eine Ebene
scrollt mit (Kamerahöhe × f). f = 1.0 bewegt sich wie die Plattformen.

1. **See (Start)**, `assets/bg/lake/`, alle 720×1280, am unteren Rand
   verankert, nicht gekachelt, oben transparent:
   - `far.png` f=0.35, `mid.png` f=0.6, `near.png` f=1.0
   - `midglow.png` (f=0.6) und `nearglow.png` (f=1.0): Lichtschein der
     Fenster, über der jeweiligen Ebene zeichnen; darf sanft pulsieren.
2. **Wald**, `assets/bg/forest/`, Höhe 1100–4700:
   - `far_tile.png` f=0.35, `mid_tile.png` f=0.6, `near_tile.png` f=1.0
   - 720×1280, vertikal nahtlos kachelbar (endlos übereinander setzen).
3. **Fjell**, `assets/bg/fjell/`, Höhe 4300–8200:
   - `mid_tile.png` f=0.6, `near_tile.png` f=1.0, vertikal kachelbar.
4. **Himmel**, `assets/bg/sky/`, ab Höhe 7400, endlos:
   - `cloud1–3.png` (ca. 562×180): Wolken, die langsam seitlich ziehen
     (f 0.75–0.95), in lockeren Abständen.
   - `moon.png` (406×406): erscheint ab Höhe ~6800 (einblenden),
     f ≈ 0.08, rechts oben, darstellen ca. 180 px.

Übergänge zwischen Welten:
- Eine Welt beginnt oben ins Bild zu kommen, wenn die Kamera die
  Starthöhe der Welt erreicht; sie wird über ca. 420 px weich
  eingeblendet und am Ende genauso ausgeblendet. Formel für eine Ebene
  mit Faktor f: sichtbar im Ebenen-Koordinatenbereich
  [start·f + Bildschirmhöhe, ende·f + Bildschirmhöhe].
- Zeichenreihenfolge: Himmel → Sterne → Polarlicht → Mond → far → mid →
  near (jeweils See, Wald, Fjell) → Wolken → Plattformen → Figur → HUD.

### Himmel, Sterne, Polarlicht (per Code)
- Himmel ist ein vertikaler Farbverlauf (oben / Mitte / unten), der sich
  stufenlos mit der Höhe ändert:
  - Höhe 0: #121034 / #3A2868 / #E89276 (Abendrot)
  - Höhe 2500: #100E32 / #2C2260 / #785096
  - Höhe 5500: #0A0A26 / #1A1846 / #3E3070
  - ab 8500: #050618 / #0E1030 / #221E54
- Sterne: zufällig verteilt, scrollen minimal mit (f ≈ 0.04), werden mit
  der Höhe dichter und heller.
- Polarlicht: weiche, leicht wabernde Bänder in Grün/Türkis mit etwas
  Violett, im oberen Bilddrittel, Intensität steigt mit der Höhe.

## Technik
- TypeScript + Phaser 3, gebaut mit Vite.
- Steuerung: Tastatur (Pfeiltasten, A/D), Touch (linke/rechte
  Bildschirmhälfte), optional Neigungssensor auf Mobilgeräten.
- Später Android über Capacitor; nichts verwenden, was dem im Weg steht.
- Alle Asset-Pfade zentral in einer Datei, damit Grafiken ausgetauscht
  werden können, ohne Spiellogik zu ändern.

## Schnittstelle für die spätere Lern-App
- Das Spiel ist ein eigenständiges Modul:
  - Eingabe = Wortliste (JSON) + Einstellungen (Sprache, Richtung, Level,
    Kategorien, Tempo).
  - Ausgabe = Ergebnis-Objekt am Rundenende: richtig und falsch
    beantwortete Wort-IDs, Punkte, erreichte Höhe, Dauer.
- Keine Abhängigkeit von einer bestimmten App-Struktur.

## Umfang der ersten Version (MVP)
- Startbildschirm mit Tempo-Wahl, durchgehendes Level durch alle vier
  Welten, Herzen, Punktestand, Pausenmenü (mit Tempo-Wahl),
  Game-Over-Bildschirm mit Liste der falsch beantworteten Wörter
  (deutsch + richtig finnisch).
- Noch nicht: Sound, Accounts, Shop, Highscore-Server, weitere Sprachen.
- Liefere den Code lauffähig mit kurzer Anleitung zum Starten
  (`npm install` / `npm run dev`).
