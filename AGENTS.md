# Hinweise für Coding-Agenten

Schreibzeug: Office-Dateien im Browser (Dokumente, Tabellen, Präsentationen, PDFs), selbst gehostet. Vite-SPA in
`apps/web`, Hono-Server in `apps/server`, Desktop-App (Tauri) in `apps/desktop`, die einzige Anbindung an die Engine
`sdkjs` in `packages/editor-core`, die festgelegte Euro-Office-Version in `engine/`.

Die Regeln stehen einmal: Beitragen in [`docs/mitwirken.md`](docs/mitwirken.md), Bauen in
[`docs/development.md`](docs/development.md), beides auf Deutsch, für Menschen und Agenten. Diese Datei sagt, wo was
steht und was nie passieren darf. Sie gilt für jeden Agenten; `CLAUDE.md` verweist nur hierher.

## Doku

Die Doku liegt in `docs/` (<https://schreibzeug.app/>). Vor dem Start die Seiten lesen, die die Änderung berühren:
`architecture.md` für das Zusammenspiel, `engine.md` dafür, wie die Oberfläche mit `sdkjs` spricht,
`collaboration.md` für das Protokoll des Relays. Links in README und Doku zeigen auf die Website, nicht auf `docs/*.md`.

## Skills

Die Schritte für wiederkehrende Aufgaben stehen in [`.agents/skills`](.agents/skills); jeder Agent folgt denselben
Dateien. Aus der [Werkbank](https://github.com/Speicherstadt/werkbank) (gleich in allen Projekten, Änderungen dort):
`beitrag` (Branch, Commits, Pull Request als Entwurf, dann Selbstprüfung und Review), `beitrag-pruefen` (gewollt,
Quellen, einfachste Lösung, Regeln), `tdd-review` (unabhängiges Review, ein Befund braucht einen fehlschlagenden
Test), `doku-pruefen` (Review des Markdowns), `fork-pushen` (Push auf den Fork einer anderen Person),
`prs-abarbeiten` (alle offenen Pull Requests, vom einfachsten Merge an), `issue-schreiben`, `board-pflegen` (das
Board auf GitHub) und `release`. Aus diesem Projekt: `checks` (alle Prüfungen, auch Engine, Desktop und Doku).

## Referenzimplementierungen

Details stützen sich auf die Quellen, nicht auf das Gedächtnis. Die API der Engine ist nicht dokumentiert, deshalb
muss jeder Aufruf auf eine dieser Quellen zurückgehen. Flach (`git clone --depth 1`) in ein temporäres Verzeichnis
klonen und die Quelldatei in Kommentaren und Commit-Nachrichten nennen, wo sie ein Detail entscheidet.

- **Euro-Office/sdkjs**, die Engine selbst: `word/api.js`, `cell/api.js`, `slide/api.js`, `common/apiBase.js`
  (`asc_openDocumentFromBytes`, Rechte, Ladekette), `common/docscoapi.js` (Transport beim gemeinsamen Bearbeiten).
- **Euro-Office/web-apps**, wie eine Oberfläche die Engine steuert. Die mobilen Editoren
  (`apps/documenteditor/mobile`, `apps/spreadsheeteditor/mobile`, `apps/presentationeditor/mobile`) sind React und
  das nächste Vorbild; die Desktop-Oberfläche (Backbone) ist die Referenz für jeden Knopf und Dialog.
- **Euro-Office/server**, `DocService/sources/DocsCoServer.js`: die Nachrichten, die das Relay sprechen muss
  (`auth`, `saveChanges`, `getLock`, `cursor`, …).
- **cryptpad/onlyoffice-editor** und **cryptpad/cryptpad** (`www/common/onlyoffice/inner.js`): Transport ohne Server,
  Sperren und Checkpoints ohne Document Server.
- **cryptpad/onlyoffice-x2t-wasm**: der Konverter als WebAssembly.
- **ranuts/document**: `docs/explorations/` hält die Fallstricke fest, die Engine ohne Server zu betreiben (Schriften,
  Speicherweg, Rechte).

## Nie

- Auf `main` pushen (Ausnahme: Reparatur eines roten `main` durch oder auf Anweisung des Maintainers), Force-Push auf
  `main`, Commits von Beitragenden umschreiben, mergen (nur Maintainer oder Collaborator mit dessen Zustimmung),
  eigenen Code reviewen.
- Einen Test überspringen, abschwächen oder löschen, um grün zu werden; einen übersprungenen Test als bestanden melden.
- Issues und Pull Requests ohne Auftrag anlegen oder kommentieren.
- Eine Abhängigkeit hinzufügen, ohne zuerst eigenen Code zu versuchen und den Grund je Paket unter
  „## Neue Abhängigkeiten“ im Pull Request zu nennen.
- Befehle als root (`sudo`, `pkexec`) ausführen oder umgehen; die führt die Nutzerin oder der Nutzer aus. Laufende
  Prozesse von ihnen stoppen; für Tests andere Ports nehmen.
- Logos, Namen oder Oberflächen-Grafiken von ONLYOFFICE oder Euro-Office (CC BY-SA) ins Produkt; Icons kommen von lucide.
- Testdateien oder Schriften, die wir nicht weitergeben dürfen: Schriften unter OFL oder Apache 2.0, Dokumente von uns
  oder unter freier Lizenz, mit Quelle in `test-files/README.md`.

## Bei jeder Änderung

Mitziehen, was die Änderung berührt, im selben Pull Request, und nur das:

- die Tests (Unit, Integration, Engine, E2E, Zusammenarbeit, Formattreue); ein Bugfix beginnt mit einem
  fehlschlagenden Test;
- die Seiten in `docs/`, die es beschreiben (Deutsch, eine `x.md` je Seite);
- das README (nur Deutsch), wenn eine Funktion, die Nutzer sehen, dazukommt, sich ändert oder wegfällt;
- die Texte der Oberfläche in beiden Sprachen (`apps/web/messages/de.json`, `en.json`);
- nach einer Änderung am Aussehen die Screenshots: **Actions → Update screenshots → Run workflow**, dann die neuen
  Bilder ansehen.

Dazu: jede berührte Datei sauberer hinterlassen und unter „Aufgeräumt“ nennen; Issues mit `Umgesetzt #…` oder
`Refs #…`, nie `Closes`/`Fixes`; Prüfungen grün vor jedem Push (Skill `checks`), übersprungene nennen, danach die CI
prüfen; die Beschreibung des Pull Requests wird die Squash-Nachricht und wird bei jedem Push nachgezogen, der etwas
daran ändert; vor dem Merge ein unabhängiges Review durch einen eigenen Agenten (`tdd-review` für Code,
`doku-pruefen` für Markdown). Jeder Commit trägt `Signed-off-by:` (`git commit -s`, siehe `CONTRIBUTING.md`).

## Arbeitsweise

- Deutsch für Kommentare, Doku, Commits, Pull Requests und alles, was Nutzer lesen; Bezeichner englisch. Ältere
  Kommentare und Commits sind englisch; was man anfasst, darf deutsch werden. Die Oberfläche auf Deutsch und Englisch:
  jeder Text in `apps/web/messages/de.json` und `en.json` (Paraglide, `m.<datei>_<name>()`), im selben Commit, keiner
  im Code; sonst schlägt `apps/web/i18n.test.ts` fehl (`docs/architecture.md#interface-texts`).
- Technik nach `tech-stack.md` in firsttris/workflows, mit diesen Abweichungen:
    - **Bun** als Paketmanager und Laufzeit; Node nur im Playwright-Image und, falls nötig, für den Build der Engine.
    - **SPA und Hono-API statt TanStack Start.** Server-Funktionen gibt es nur, solange der Start-Server läuft; die
      Tauri-App liefert die Oberfläche als statische Dateien und braucht ohnehin eine HTTP-API. Der typisierte Client
      (`hc<AppType>`) gibt dieselben Typen von Ende zu Ende; das Relay läuft im selben Server (WebSocket von Hono).
    - **`sdkjs` ist eingebunden, nicht neu geschrieben.** Es ist kein React und hat ein eigenes Canvas; Tailwind gilt
      nur für die Oberfläche drumherum.
    - **`packages/editor-core` ist TypeScript ohne Framework**, der einzige Code, der `sdkjs` aufruft; er macht aus
      Ereignissen der Engine einen Store. React nur in `apps/web`.
- Clean Code, funktional: klare Namen, kleine Funktionen, die eine Sache tun, Abhängigkeiten werden übergeben, keine
  Doppelungen, kein toter Code, Kommentare sagen warum. SOLID und Entwurfsmuster als Funktionen, Daten und Closures,
  nie als Klassen oder Vererbung. Reine Funktionen, Seiteneffekte am Rand, Fehler als Werte. Eine Datei über ~400
  Zeilen und eine Funktion über ~80 werden geteilt; ein Refactor ändert kein Verhalten.
- **Engine-Version:** `engine/` legt einen Euro-Office-Tag fest. Ein Update der Engine ist ein eigener Pull Request
  und geht nur durch, wenn die Screenshots der Formattreue gleich bleiben.
- **Dateien bleiben Dateien:** gespeichert wird immer im Originalformat (.docx, .xlsx, .pptx), kein eigenes Format.
- **Lizenz:** das ganze Repository steht unter AGPL-3.0-only, weil die Oberfläche `sdkjs` einbindet; der Dialog „Über“
  verlinkt den laufenden Quellcode.
- Fremde, nicht committete Änderungen gehören jemand anderem (oft einem anderen Agenten): beim eigenen Umfang bleiben.
