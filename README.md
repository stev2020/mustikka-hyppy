# Mustikka Hyppy – Vokabel-Sprungspiel

Doodle-Jump-artiges Browserspiel zum Vokabellernen (zuerst Deutsch → Finnisch).
Eine Heidelbeere springt automatisch nach oben. Du lenkst nur nach links oder rechts
und landest auf der Planke mit der richtigen Übersetzung.

TypeScript + Phaser 3, gebaut mit Vite. Design-Auflösung 720×1280 (Hochformat).

**Online spielen:** https://stev2020.github.io/mustikka-hyppy/ (am Handy im Browser öffnen,
Chrome empfohlen). Jeder Push auf `main` baut und veröffentlicht die Seite automatisch
über GitHub Actions (`.github/workflows/pages.yml`).

## Starten

Voraussetzung: Node.js 20.19+ oder 22.12+.

```bash
npm install
npm run dev        # Entwicklungsserver, Adresse steht in der Konsole (meist http://localhost:5173)
npm run build      # Produktions-Build nach dist/
npm run preview    # Build lokal ansehen
npm run check      # Level-Generator ohne Browser prüfen (Erreichbarkeit, Optionen, Wiederholung)
npm run day-assets # Tag-Hintergründe neu erzeugen (nach Austausch der Hintergrundgrafiken)
```

### Auf dem Handy testen

```bash
npm run handy      # Dev-Server im WLAN über HTTPS
```

In der Konsole steht eine „Network“-Adresse wie `https://192.168.178.23:5173`. Die im
Handy-Browser öffnen, das Handy muss im selben WLAN sein. Beim ersten Aufruf warnt der
Browser vor dem selbst signierten Zertifikat. Über „Erweitert“ → „Weiter zu …“ geht es
trotzdem. HTTPS ist nötig, weil Browser den **Neigungssensor** nur auf sicheren Seiten
freigeben. Über `http://192.168…` kommen keine Sensorwerte an, im Menü steht dann
„Neigungssteuerung: braucht https://“.

Während einer Runde bleibt der **Bildschirm an** (Screen Wake Lock, ebenfalls nur über
HTTPS). In der späteren Android-App übernimmt das z. B. `@capacitor-community/keep-awake`.
Die Lautstärke von Effekten und Aussprache steht in `AUDIO` (`src/config/tuning.ts`).

Auf Handy und Tablet ist nur **Hochformat** vorgesehen. Wo der Browser es erlaubt, wird der
Bildschirm per Screen Orientation API gesperrt; sonst erscheint im Querformat der Hinweis
„Bitte das Handy hochkant halten“ und eine laufende Runde pausiert. Nach jeder Drehung
wird das Spielfeld neu eingepasst (`src/game/orientation.ts`). Am PC gibt es keine Sperre.

Die **Aussprache** braucht einen Browser mit Sprachausgabe: Chrome auf Android nutzt
die Google-Stimmen des Handys. DuckDuckGo und manche andere Browser bieten keine Stimmen
an, dort steht „Aussprache: keine Stimme“. Der Schalter zeigt den Namen der gewählten
Stimme, z. B. „Aussprache: Satu“. Es werden nur Stimmen genommen, deren Sprache genau
Finnisch ist.

Auf **iPhone/iPad** (alle Browser nutzen dort Safari-Technik) ist die finnische Stimme
„Satu“ dabei. Die iOS-Spaßstimmen wie „Eddy“ oder „Grandma“ werden nur genommen, wenn es
sonst keine gibt. Eine bessere Qualität gibt es unter Einstellungen → Bedienungshilfen →
Gesprochene Inhalte → Stimmen → Finnisch → „Satu (Premium)“ laden. Die wird dann
automatisch bevorzugt. iOS spricht erst nach der ersten Berührung, deshalb schaltet das
Spiel die Sprachausgabe beim ersten Antippen stumm frei.

Nützliche URL-Parameter für das Testspiel:

| Parameter | Wirkung |
|---|---|
| `?tempo=slow\|normal\|fast` | Tempo vorgeben |
| `?theme=day\|night` | Tag oder Abend |
| `?direction=reverse` | Finnisch → Deutsch |
| `?levels=1` / `?levels=1,2` | nur diese Vokabel-Level |
| `?categories=tiere,natur` | nur diese Kategorien |
| `?play` | Startbildschirm überspringen |
| `?debug` | Höhe und Kamera einblenden, Taste **B** schaltet einen Autopiloten ein (nur zum Testen) |

## Tageszeit: Abend und Tag

Im Startbildschirm kannst du zwischen **Abend** (Original) und **Tag** umschalten,
auch mit der Taste T. Die Wahl wird gespeichert. In der Lern-App setzt du sie mit
`settings.theme: 'day' | 'night'`.

Die Tag-Variante verwendet dieselben Motive. `scripts/make-day-assets.mjs` färbt
die Hintergründe um und legt sie in `assets/day/bg/` ab: Violett wird zu hellem
Himmelblau, Schatten werden aufgehellt, und ferne Ebenen bekommen etwas Dunst.
Dazu kommen ein heller Himmelsverlauf und eine per Code gezeichnete Sonne.
Sterne und Polarlicht gibt es nur am Abend. Die Farben stehen in
`src/config/themes.ts`, die Stärke der Umfärbung je Ebene in der `JOBS`-Liste
des Skripts. Wenn du Hintergrundgrafiken austauschst, danach `npm run day-assets`
ausführen.

## Highscore

Der beste Punktestand und die Rekordhöhe werden lokal auf dem Gerät gespeichert
(localStorage, Schlüssel `mustikka-hyppy.highscore`). Das Startmenü zeigt beide an.
Im Spiel erscheint „Neuer Highscore!“, sobald der alte Rekord überboten ist. Der
Game-Over-Bildschirm zeigt den neuen Rekord mit dem alten Wert. Im Ergebnis-Objekt
stehen dazu `newHighscore` und `previousHighscore`.

## Heidelbeeren, Sonderplattformen, Serien

- **Heidelbeeren** schweben seitlich versetzt zwischen den Plattformen und über den
  bröselnden Extra-Planken. Jede Beere bringt 10 Punkte. Sie fliegt in den Zähler oben
  links, zum Beispiel „3/10“. Bei 10 Beeren gibt es ein Herz zurück, bei vollen Herzen
  250 Bonuspunkte.
- **Bewegliche Plattformen** (ab 15 m) gleiten hin und her. Ihr Tempo passt sich der
  Tempo-Stufe an.
- **Sprungfedern** (ab 25 m) sind goldene Planken mit Pfeilen. Sie schleudern die Beere
  gut doppelt so hoch.
- **Bröselnde Planken** (ab 7 m) sind dunkel und morsch und liegen seitlich neben dem
  Weg. Sie halten genau einen Sprung.
- **Serien:** Oben rechts steht „Serie 5 · ×1,5“. Bei 5, 10, 15 … richtigen Antworten in
  Folge leuchtet das Polarlicht auf und es regnet Funken.

Die Garantien des Levels bleiben erhalten, `npm run check` prüft sie. Bewegliche
Plattformen liegen höchstens 118 px über oder unter ihren Nachbarn, damit jede Position
erreichbar ist. Eine Feder gibt es nur, wenn ihr hoher Sprung unter der nächsten
Wortreihe endet. Bröselnde Planken sind nie nötig, um weiterzukommen, und liegen nie
in der Schutzzone um eine Reihe. Keine Reihe lässt sich überspringen. Alle Werte stehen
in `SPECIALS` (`src/config/tuning.ts`).

## Wortlisten

**Standardliste:** `vocab/de-fi-grundwortschatz.json` ist ein eigener, frei zusammengestellter
Grundwortschatz Deutsch → Finnisch mit 669 Wörtern und Wendungen in 19 Themen: Begrüßung,
Zahlen, Zeit, Familie, Körper, Essen, Wohnen, Stadt, Unterwegs, Kleidung, Farben, Natur
und Wetter, Tiere, Arbeit, Freizeit, Verben, Adjektive, kleine Wörter, Wendungen. Die
Liste steht unter CC0 (frei verwendbar). Bearbeitet wird sie in
`scripts/wordlist/grundwortschatz.txt`, eine Zeile je Wort:

```
Stufe | Deutsch | Finnisch | weitere richtige Varianten (mit ; getrennt)
3|lernen|oppia|opiskella
```

`npm run wordlist` erzeugt daraus die JSON-Datei und prüft auf doppelte und zu lange
Einträge. Varianten gelten als richtig und werden nie als falsche Planke angeboten. So
kommt zum Beispiel bei „lernen“ nie „opiskella“ als falsche Antwort.

**Private Listen:** JSON-Dateien in `vocab/privat/` sind beim lokalen Start (`npm run dev`,
`npm run handy`) automatisch als weitere Liste dabei. Der Ordner steht in `.gitignore` und
wird nicht veröffentlicht. Dort liegt zum Beispiel eine Lehrbuch-Wortliste für den
eigenen Gebrauch.

**Listen im Spielformat importieren:** Der Import im Startmenü nimmt auch `.json`-Dateien
in diesem Format an. Stufen, Kategorien und Varianten bleiben dabei erhalten. So kommt
eine private Liste auch auf die öffentliche Seite im Handy-Browser.

## Lernpfad und Lernstand

Jedes Wort hat eine **Schwierigkeitsstufe 1–5** (Feld `level`). In der Standardliste
ist sie für deutschsprachige Anfänger eingeschätzt:
- **1:** Zahlen, erste Grüße, Lehnwörter wie „hotelli“
- **3:** längere Alltagswörter, häufige Verben und Adjektive
- **4:** seltenere Wörter, lange Komposita, einfache ganze Sätze
- **5:** Wendungen mit Kasusendungen wie „Suomessa“ oder „Minulla on nälkä.“

Verteilung: 75 / 177 / 215 / 173 / 29 Wörter. Importierte Anki-Decks werden automatisch
grob eingestuft, nach Kapitel-Tag, Länge und Wendungen.

**Lernpfad:** Das Spiel beginnt mit den leichtesten Wörtern. Höchstens 15 Wörter sind
gleichzeitig „in Arbeit“. Ein neues kommt erst dazu, wenn eines sicher sitzt, also 3× in
Folge richtig. Etwa jede fünfte Frage wiederholt ein schon sicheres Wort, fällige zuerst.
Wörter, die du oft falsch machst, kommen häufiger. Einstellbar unter `LEARNING` in
`src/config/tuning.ts`.

**Gespeichert** wird je Wort das Fach (0–4), wie oft richtig und falsch und wann zuletzt.
Das liegt lokal im Browser und bleibt über Sitzungen erhalten, getrennt je Wortliste.
PC und Handy haben also jeweils einen eigenen Stand. Die Lern-App kann später über
`progressStore` einen gemeinsamen Speicher anschließen.

**Übersicht:** Die Leiste unter dem Titel im Startmenü antippen, zum Beispiel
„80/669 sicher · 20 in Arbeit ▸“. Sie zeigt je Stufe sicher / in Arbeit / neu und die
Wörter, die oft falsch sind, mit ✗/✓-Zählern. „Zurücksetzen“ (zweimal tippen) löscht den
Lernstand der aktiven Liste. Am Rundenende steht, wie viele Wörter neu gelernt wurden.

## Anki-Wortlisten importieren

Im Startmenü unten auf **„Import …“** tippen und eine Anki-Datei wählen. Das geht am PC
und am Handy.
- **.apkg:** das Anki-Paket, auch von AnkiWeb heruntergeladen. Unterstützt werden alte
  und neue Anki-Formate.
- **.txt / .tsv / .csv:** Anki → Datei → Exportieren → „Notizen als Klartext“.
- **.json:** eine Wortliste im Spielformat (siehe „Wortlisten“), wird direkt übernommen.

Im Import-Dialog ist vorbelegt, welches Feld Finnisch ist und welches die Übersetzung.
Die Sprache der Übersetzung wird erkannt (Englisch, Deutsch, …). Alles lässt sich per
Antippen ändern, die Vorschau zeigt sofort das Ergebnis. Beim Import passiert Folgendes:
- HTML, Audio-Verweise und zusätzliche Zeilen werden entfernt.
- Bei „suuri, iso“ steht die ganze Karte auf der Planke, wenn sie passt. Beide Varianten
  gelten als richtig und kommen nie als falsche Planke vor.
- Übersprungen werden leere Karten, zu lange Antworten (über 24 Zeichen) und doppelte
  Karten. Ebenso Karten, die auf beiden Seiten gleich sind („tango → tango“).
- Kategorien kommen aus den Anki-Tags, zum Beispiel „Food“ oder „Kapitel 3“. Sie steuern,
  welche falschen Planken erscheinen.
- Karten, die in Anki schon gelernt sind, starten mit passendem Lernstand.

Die Liste wird im Browser gespeichert. Durch Antippen der Wortlisten-Taste wechselst du
zwischen der Standardliste und deinen Importen. **✕** (zweimal tippen) löscht die
aktive importierte Liste. Der Lernstand wird je Liste geführt, ein erneuter Import
desselben Decks behält ihn. Die Bibliotheken dafür (sql.js, fflate, fzstd) werden erst
beim Import geladen. Ohne Browser testen: `npm run test-import -- datei.apkg`. Für die
Einbettung in die Lern-App lässt sich der Import mit `settings.allowImport: false`
ausblenden.

## Sound, Aussprache und Lernstand

**Sound:** Alle Effekte werden per WebAudio im Code erzeugt, es gibt keine Audiodateien.
Zu hören sind ein leises Hopp beim Sprung, ein Glockenspiel bei richtig, knackendes Holz
bei falsch, ein Ton beim Herzverlust, ein Wusch bei der Wort-Einblendung, eine Fanfare
beim Highscore, ein Ton bei 5, 10 … richtigen in Folge und eine Melodie bei Game Over.
Umschalten im Start- oder Pausenmenü oder mit der Taste **M**.

**Aussprache:** Bei einer richtigen Antwort und bei der Lösung nach einer falschen wird
das finnische Wort vorgelesen. Das nutzt die Sprachausgabe von Browser bzw. System und
braucht eine finnische Stimme. Fehlt sie, steht im Menü „Aussprache: keine Stimme“.
- **Windows:** Chrome findet dort meist keine finnische Stimme. Auch nach der Installation
  des finnischen Sprachpakets bleibt es oft dabei, weil Chrome die neueren Windows-Stimmen
  nicht sieht. **Microsoft Edge** bringt finnische Online-Stimmen mit (Harri, Selma), dort
  funktioniert die Aussprache direkt.
- **Android (Capacitor):** Die WebView hat oft keine Sprachausgabe. Deshalb kann man eine
  eigene Funktion übergeben, z. B. mit `@capacitor-community/text-to-speech`:
  ```ts
  import { TextToSpeech } from '@capacitor-community/text-to-speech';
  createMustikkaHyppy({ …, speak: (text, lang) => TextToSpeech.speak({ text, lang, rate: 0.9 }) });
  ```

**Lernstand über Runden (Karteikasten):** Jedes Wort liegt in einem Fach von 0 bis 4.
Richtig schiebt es ein Fach weiter, falsch zurück in Fach 0. Unsichere Wörter und Wörter,
deren Wiederholung fällig ist, werden häufiger gezogen. Fällig heißt: nach 10 Minuten,
1 Tag, 3 Tagen bzw. 7 Tagen, je nach Fach. Was in der Runde schon dran war, kommt seltener.
Ab Fach 3 gilt ein Wort als „sicher“. Das Startmenü zeigt dazu „x/55 Wörter sicher“.
Gespeichert wird lokal (`mustikka-hyppy.progress.forward` bzw. `.reverse`). Die Lern-App
kann einen eigenen Speicher übergeben: `progressStore: { load(), save(map) }`.

## Steuerung

- Tastatur: ← → oder A / D, Pause mit Esc oder P, Ton an/aus mit M
- Touch: linke / rechte Bildschirmhälfte gedrückt halten
- Neigungssensor: im Startbildschirm auf Mobilgeräten einschaltbar (iOS fragt nach Erlaubnis)

## Projektstruktur

```
assets/                 fertige Grafiken (werden unverändert ausgeliefert)
assets/day/             umgefärbte Tag-Hintergründe (erzeugt mit npm run day-assets)
vocab/de-fi-grundwortschatz.json  Standard-Wortliste (erzeugt aus scripts/wordlist/grundwortschatz.txt)
vocab/privat/           eigene Listen, nur lokal (nicht im Repository)
vocab/de-fi-basis.json  kleines Beispiel mit handverlesenen Ablenkern und Grammatikformen
src/
  config/assets.ts      ALLE Asset-Pfade + Bildgeometrie (Anker, Laufflächen, Slice-Ränder)
  config/tuning.ts      Physik, Tempo, Level, Schwierigkeit, Welten, Himmelsfarben
  config/settings.ts    Einstellungen + lokale Speicherung (Tempo, Tageszeit, Neigung)
  config/themes.ts      Tageszeiten: Himmelsfarben, Sterne/Polarlicht/Sonne, Tag-Hintergründe
  vocab/                Datenformat, Auswahl der Wörter, Ablenker, Wiederholungen, Lernstand
  level/                Level-Generator mit Erreichbarkeits-Garantien, Reihen-Layout
  import/               Anki-Import (.apkg/.txt), Aufräumen, gespeicherte Wortlisten
  audio/                Soundeffekte (WebAudio) und Aussprache (Sprachausgabe)
  render/               Hintergrund (Parallax, Himmel, Sterne, Polarlicht), Planken, UI
  scenes/               Boot, Menü, Spiel, Pause, Game Over
  game/createGame.ts    Modul-Einstieg (siehe unten)
  main.ts               eigenständiges Testspiel
scripts/check-level.ts  Prüfskript für `npm run check`
scripts/make-day-assets.mjs  erzeugt die Tag-Hintergründe
```

Grafiken tauscht man aus, indem man die Dateien ersetzt oder die Pfade in
`src/config/assets.ts` ändert. Ändert sich die Bildgeometrie (z. B. wo die Figur
steht), passt man die Werte in derselben Datei an.

## Einbettung in die Lern-App

```ts
import { createMustikkaHyppy } from './src/index';

const game = createMustikkaHyppy({
  parent: document.getElementById('spiel')!,
  words: meineWortliste,               // Array von Einträgen oder { meta, entries }
  settings: {
    sourceLang: 'de', targetLang: 'fi',
    direction: 'forward',              // 'reverse' = FI → DE
    levels: [1, 2],
    categories: ['tiere', 'haus'],
    tempo: 'normal',                   // 'slow' | 'normal' | 'fast'
    theme: 'day',                      // 'day' | 'night'
    sound: true,                       // Soundeffekte
    pronunciation: true,               // finnische Wörter vorlesen
    showMenu: false,                   // direkt starten
    allowMenu: false,                  // statt "Hauptmenü" gibt es "Beenden" (ruft onExit auf)
    assetBaseUrl: './mustikka/',       // wo der assets-Ordner liegt
  },
  onResult: (r) => speichereFortschritt(r),
  onExit: () => zurueckZurApp(),
  speak: (text, lang) => …,            // optional: eigene Sprachausgabe
  progressStore: meinLernprofil,       // optional: { load(), save(map) }
});
// game.setTempo('fast'); game.pause(); game.resume(); game.destroy();
```

Am Rundenende (Absturz, keine Herzen mehr oder Abbruch) kommt ein Ergebnis-Objekt,
per `onResult` und als DOM-Event `mustikka-hyppy:result` am parent-Element:

```ts
{
  correctIds: string[],      // mindestens einmal richtig
  wrongIds: string[],        // mindestens einmal falsch
  answers: [{ id, prompt, answer, chosen, correct, height, timeMs }],
  score: number,
  maxHeight: number,         // Design-Pixel
  maxHeightMeters: number,   // wie im HUD (100 px = 1 m)
  durationMs: number,
  tempo, direction,
  endedBy: 'fall' | 'hearts' | 'quit',
  berries: number,           // eingesammelte Heidelbeeren
  newHighscore: boolean,     // Punkte-Rekord geknackt
  previousHighscore: number
}
```

### Vokabelformat

```json
{
  "id": "talo-ine",
  "source": "im Haus",
  "target": "talossa",
  "lemma": "talo",
  "form": "inessiv",
  "category": "haus",
  "level": 2,
  "distractors": ["talosta", "taloon", "talolla"]
}
```

`source` und `target` sind nur Spalten. Welche Sprache sie sind, steht in `meta`
(`sourceLang`, `targetLang`) oder in den Einstellungen.

## Wie die Regeln umgesetzt sind

- **Tempo:** Flugzeit 1,2 / 0,95 / 0,75 s. g = 8·h/T² und v0 = 4·h/T bei h = 230 px.
  Die Seitwärtsgeschwindigkeit skaliert mit 1/T. Die Geometrie ist also bei jedem
  Tempo gleich. Mit der Höhe wird die Simulation um höchstens 15 % beschleunigt
  (ab 1500 px Höhe, volle 15 % bei 10 000 px). Tempo-Wechsel im Pausenmenü gilt sofort.
- **Level:** Zwischen zwei Wortreihen liegen 6–7 neutrale Plattformen. Direkt unter jeder
  Reihe liegt eine Absprungplattform, 150 px tiefer und in einer Lücke zwischen den
  Planken. Von ihr sind alle Optionen erreichbar. Keine andere Plattform erreicht die
  Reihe, und über der Reihe ist nichts von der Absprungplattform aus erreichbar. Die
  Reihe lässt sich also nicht überspringen. `npm run check` prüft das für 80 Level
  bis Höhe 40 000. Die erste Reihe liegt beim Start bei etwa 785 px Höhe, also rund
  500 px unter dem oberen Rand.
- **Falsche Planke:** Sie zerbricht mit Splittern aus der echten Holztextur, du verlierst
  ein Herz, und die Figur fällt durch. Die richtige Planke leuchtet auf und bleibt stehen.
  Oben steht kurz „Wort = Lösung“. Die übrigen falschen Planken verschwinden ohne Strafe.
  Das Wort kommt nach 3–4 Reihen noch einmal.
- **Neues Wort in der Mitte:** Nach einer richtigen Antwort springt das nächste Wort groß
  in der Bildmitte auf, mit Funken und Leuchten. Es bleibt je nach Länge 0,85–1,5 s stehen
  und fliegt dann verblassend nach oben in die Anzeige. Nach einer falschen Antwort
  erscheint dort zuerst die Lösung in Grün. Zeiten und Position stehen in `ANNOUNCE`
  (`src/config/tuning.ts`).
- **Schwierigkeit mit der Höhe:** 2 Optionen, ab 1500 px 3 und ab 3600 px 4. Ablenker kommen
  zuerst aus einer anderen Kategorie, ab 2500 px aus derselben Kategorie und ab 5500 px sind
  es andere Formen desselben Worts. Grammatikformen (Level 2) kommen ab 3000 px dazu.
  Innerhalb einer Stufe haben die handverlesenen `distractors` Vorrang. Reichen sie nicht,
  werden Ablenker automatisch ergänzt.
- **Lesezeit:** Die Kamera hält die Figur im unteren Drittel. Eine neue Reihe ist dann
  etwa 660 px über der Figur zu sehen, also rund 4 Sprünge vorher. Das oben angezeigte Wort
  kennt man schon, bevor die Reihe auftaucht.
- **Welten:** Jede Ebene ist im Bereich [start·f + H, ende·f + H] sichtbar und wird über
  420 px weich ein- und ausgeblendet (per Eck-Transparenz auf 64-px-Streifen).
  Zeichenreihenfolge wie vorgegeben.

## Android (Capacitor)

```bash
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Mustikka Hyppy" fi.mustikka.hyppy --web-dir dist
npx cap add android
npx cap sync android && npx cap open android
```

In der App das Hochformat fest einstellen: in `android/app/src/main/AndroidManifest.xml`
bei der `<activity>` `android:screenOrientation="portrait"` ergänzen.

Das Spiel nutzt nur relative Pfade (`base: './'`) und lädt nichts aus dem Netz. Es
braucht keine Browser-APIs, die in der WebView fehlen.

## Noch nicht enthalten (MVP)

Accounts, Shop, Highscore-Server, weitere Sprachen (das Datenformat ist schon dafür ausgelegt).
