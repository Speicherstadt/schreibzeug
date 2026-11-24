<div align="center">

<h1>Schreibzeug – wie Google Docs, nur auf deinem eigenen Server</h1>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/editor-dark.png">
  <img src="docs/screenshots/editor-light.png" alt="Schreibzeug, ein selbst gehosteter Word-Editor im Browser: ein .docx-Dokument mit Werkzeugleiste für Absatzformat, Schrift, Größe, fett, kursiv, Farben, Listen und Ausrichtung" width="900">
</picture>

**Word-, Excel- und PowerPoint-Dateien bearbeiten – .docx, .xlsx, .pptx und PDF, Open Source**<br>
Gemeinsam in Echtzeit, im Browser oder als Desktop-App. Ohne Dokumentenserver und ohne Tracking. Made in Europe.

[![CI](https://github.com/Speicherstadt/schreibzeug/actions/workflows/ci.yml/badge.svg)](https://github.com/Speicherstadt/schreibzeug/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Speicherstadt/schreibzeug?logo=github&label=release)](https://github.com/Speicherstadt/schreibzeug/releases/latest)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-schreibzeug.app-4f46e5?logo=zensical&logoColor=white)](https://schreibzeug.app/)
[![Desktop](https://img.shields.io/badge/desktop-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](https://github.com/Speicherstadt/schreibzeug/releases/latest)
[![Docker Pulls](https://img.shields.io/docker/pulls/tristanteu/schreibzeug?logo=docker&logoColor=white)](https://hub.docker.com/r/tristanteu/schreibzeug)

[Warum?](#warum-schreibzeug) •
[Funktionen](#funktionen) •
[Schnellstart](#schnellstart) •
[FAQ](#faq) •
[Dokumentation](https://schreibzeug.app/) •
[Entwicklung](#entwicklung)

🖱️ **[Demo ausprobieren](https://schreibzeug.app/demo/)** – die Editoren mit Beispieldateien, im Browser, ohne Installation

</div>

## Warum Schreibzeug?

Office-Pakete aus der Cloud halten deine Dokumente auf fremden Servern und kosten pro Benutzer.
Selbst gehostete Office-Pakete brauchen meist einen eigenen Dokumentenserver neben Nextcloud.
Schreibzeug ist ein kleiner Server mit eigener Oberfläche und eigener Dateiverwaltung.

- **Digitale Souveränität (DSGVO)**: Deine Dokumente liegen auf deinem Server oder mit der
  Desktop-App auf deinem eigenen Rechner. Kein US-Anbieter dazwischen, also kein Zugriff über den
  US CLOUD Act; kein fremder Dokumentenserver, keine Telemetrie, und Open Source, also kann dir das
  niemand wegnehmen.
- **Echte Office-Dateien**: Eine .docx bleibt eine .docx, eine .xlsx eine .xlsx, eine .odt eine
  .odt – Word, Excel und LibreOffice öffnen sie wie vorher.
- **Ausgereifte Kompatibilität**: Die Engine ist Euro-Office, der Open-Source-Fork von ONLYOFFICE;
  Tabellen, Änderungsverfolgung, Kommentare, Diagramme und Pivot-Tabellen kommen heil an.
- **Gemeinsam in Echtzeit**: Mehrere Leute in derselben Datei, mit Kommentaren live und dem Namen der
  anderen über ihrem Cursor, ohne Dokumentenserver.
- **E-Rechnungen**: ZUGFeRD-Rechnungen direkt aus einem Rechnungsdokument, E-Rechnungen in PDFs
  werden gelesen und angezeigt.
- **Mit der Tastatur bedienbar**: Menüs und Werkzeugleisten gehen ohne Maus –
  [mehr zur Barrierefreiheit](https://schreibzeug.app/accessibility.html).
- **KI, wenn du willst**: Claude Code und andere Assistenten finden, lesen und schreiben deine
  Dateien mit deinen Rechten; Änderungen an einem offenen Dokument brauchen deine Zustimmung und
  lassen sich rückgängig machen.
- **Einfach zu betreiben**: ein Container mit einer SQLite-Datenbank und einem Datenordner; wer den
  Ordner sichert, sichert alles.

## Funktionen

Kurz je Bereich; die Details stehen auf der verlinkten Seite der [Dokumentation](https://schreibzeug.app/).

| Bereich | Was Schreibzeug kann |
|---|---|
| 📝 [Dokumente](https://schreibzeug.app/engine.html#mail-merge) (.docx) | **Kommentare und Änderungsverfolgung**, Kopf- und Fußzeilen und Inhaltsverzeichnis, Rechtschreibprüfung auf Deutsch und Englisch, Vorlagen, **Serienbrief**, **E-Rechnungen** (ZUGFeRD), PDF und PDF/A |
| 📊 [Tabellen](https://schreibzeug.app/engine.html#spreadsheets) (.xlsx) | Formeln, Zahlenformate, Sortieren und Filter, fixierte Zeilen, **Diagramme**, **Pivot-Tabellen**, Auswahllisten, bedingte Formatierung, CSV |
| 📽️ [Präsentationen](https://schreibzeug.app/engine.html#presentations) (.pptx) | Folienlayouts, Formen, Designs, Übergänge, Sprechernotizen und eine **Bildschirmpräsentation** |
| 📄 [PDFs](https://schreibzeug.app/pdf.html) | **Formulare ausfüllen und unterschreiben**, von Hand oder **digital** mit deinem Zertifikat (nicht qualifiziert), Notizen und Markieren, **Schwärzen**, Seiten einfügen und entfernen, **Texterkennung (OCR)** für Scans |
| 🗒️ [Markdown & Text](https://schreibzeug.app/text.html) (.md, .txt) | Eine **Live-Ansicht**, in der der Text Markdown bleibt, oder Quelle und Vorschau nebeneinander; Zeichenkodierung und Zeilenenden bleiben Byte für Byte |
| 📁 [Dateien & Teamarbeit](https://schreibzeug.app/files.html) | Ordner, Hochladen, zuletzt geöffnete Dateien und Papierkorb, **Versionen** zum Zurückholen, **Teilen** mit Konten oder per Link, **gemeinsam in Echtzeit** mit Cursorn, eine Kopie einer Datei öffnen, die **eine andere App** per Link übergibt, **im Archiv ablegen** als PDF/A |
| 🤖 [KI & Kontext](https://schreibzeug.app/mcp.html) | **MCP-Server** für Claude Code und andere MCP-Clients, mit deinen Rechten und mit Rückfrage, bevor er ein offenes Dokument ändert; **Anmeldung über [Kontext](https://github.com/Speicherstadt/kontext)** und Schreibzeug als dessen Dokumente-Modul |
| 🖥️ [Desktop-App](https://schreibzeug.app/desktop.html) | **Windows, macOS und Linux** (Tauri): die Dateien in deinem Dokumente-Ordner ganz ohne Server, oder ein Fenster auf einen Schreibzeug-Server (noch nicht signiert) |
| 🌐 [Deutsch und Englisch](https://schreibzeug.app/architecture.html#interface-texts) | Die Oberfläche auf **Deutsch oder Englisch**, wie der Browser es wünscht oder in den Einstellungen gewählt |
| ♿ [Barrierefreiheit](https://schreibzeug.app/accessibility.html) | Menüs und Werkzeugleisten per **Tastatur**, **Unterstützung für Screenreader** in Dokumenten, Tabellen und Präsentationen (nur wenn eingeschaltet, Strg+Alt+Z), automatisch gegen WCAG 2.2 AA geprüft |

## Screenshots

<table>
  <tr>
    <td width="50%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/files-dark.png"><img src="docs/screenshots/files-light.png" alt="Dateiansicht von Schreibzeug: Ordner, Word-Dokumente, eine Tabelle und eine Präsentation mit letzter Änderung und Größe, Knöpfe für neuen Ordner, neue Datei und Hochladen"></picture><br><sub><b>Dateien</b>: Ordner und Dateien mit letzter Änderung und Größe</sub></td>
    <td width="50%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/spreadsheet-dark.png"><img src="docs/screenshots/spreadsheet-light.png" alt="Selbst gehosteter Tabelleneditor für .xlsx-Dateien im Browser: Werkzeugleiste, Formelzeile und Raster mit Blatt-Reitern"></picture><br><sub><b>Tabelle</b>: .xlsx mit Formelzeile und Blatt-Reitern</sub></td>
  </tr>
  <tr>
    <td width="50%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/presentation-dark.png"><img src="docs/screenshots/presentation-light.png" alt="Präsentationseditor für .pptx-Dateien: Folienliste links, die Titelfolie eines Vortrags und die Werkzeugleiste darüber"></picture><br><sub><b>Präsentation</b>: Folienliste, Folie und Werkzeugleiste</sub></td>
    <td width="50%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/pdf-dark.png"><img src="docs/screenshots/pdf-light.png" alt="PDF-Editor im Browser: Werkzeuge zum Markieren, Zeichnen, für Notizen, Unterschrift und Schwärzen neben einem ausgefüllten Bestellformular"></picture><br><sub><b>PDF</b>: Formular ausfüllen, unterschreiben, schwärzen</sub></td>
  </tr>
  <tr>
    <td width="50%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/comments-dark.png"><img src="docs/screenshots/comments-light.png" alt="Kommentare neben einem Word-Dokument in Schreibzeug, mit Antworten"></picture><br><sub><b>Kommentare</b>: neben dem Dokument, mit Antworten</sub></td>
    <td width="50%"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/share-dark.png"><img src="docs/screenshots/share-light.png" alt="Einen Ordner mit einem anderen Konto oder per Link teilen, zum Bearbeiten oder Ansehen"></picture><br><sub><b>Teilen</b>: mit einem Konto oder per Link, zum Bearbeiten oder Ansehen</sub></td>
  </tr>
</table>

## Schreibzeug und die Alternativen

Schreibzeug ist für alle gemacht, die die Kompatibilität einer ausgereiften Office-Engine mit einer
Oberfläche wie bei heutigen Web-Apps wollen, auf dem eigenen Server.

| | Was es ist | Was Schreibzeug anders macht |
|---|---|---|
| [ONLYOFFICE Docs](https://github.com/ONLYOFFICE/DocumentServer) / [Euro-Office](https://github.com/Euro-Office) | Office-Engine fürs gemeinsame Arbeiten mit einer Oberfläche wie Microsoft Office, meist in Nextcloud eingebettet | Dieselbe Engine, eine neue Oberfläche, eigene Dateiverwaltung, kein Dokumentenserver |
| [Collabora Online](https://github.com/CollaboraOnline/online) | LibreOffice im Browser, mit OpenDocument als Standardformat | Microsoft-Formate (.docx, .xlsx, .pptx) als Standardformat |
| [CryptPad](https://github.com/cryptpad/cryptpad) | Ende-zu-Ende verschlüsselte Suite fürs gemeinsame Arbeiten | Dateien bleiben einfache .docx, .xlsx und .pptx auf deinem Speicher |
| Microsoft 365 und andere | Office-Pakete in der Cloud | Selbst gehostet, Open Source, kein Preis pro Benutzer |

## Schnellstart

Schreibzeug läuft als zwei Container: die App (`tristanteu/schreibzeug`, amd64) mit einer SQLite-Datenbank und einem
Datenordner, und Caddy für HTTPS. Du brauchst einen Linux-Server oder VPS mit Docker oder Podman; ein Heimserver geht
auch. Ganz ohne Server gibt es die Desktop-App für Windows, macOS und Linux.

### 1. Von einem Agenten aufsetzen lassen

Gib Claude Code oder einem anderen Coding-Agenten dieses Repository und SSH-Zugang zu deinem Server und sag:
„Setz Schreibzeug auf meinem Server auf, nach der [Installationsanleitung](https://schreibzeug.app/installation.html).“

### 2. Manuell

Mit einer Domain, die auf den Server zeigt, und offenen Ports 80 und 443:

```bash
# Die Konfiguration (compose.yaml, .env.example, Caddyfile); die Programme kommen von Docker Hub
git clone https://github.com/Speicherstadt/schreibzeug /opt/schreibzeug && cd /opt/schreibzeug
cp deploy/.env.example deploy/.env
nano deploy/.env                                          # Domain, Mail für Let's Encrypt, Version
docker compose -f deploy/compose.yaml up -d schreibzeug   # lädt Schreibzeug und startet es, vorerst nur auf dem Server selbst
```

Danach:

1. Das erste Konto über einen SSH-Tunnel anlegen (`ssh -L 3000:127.0.0.1:3000 <server>`, dann
   http://localhost:3000), bevor jemand anderes den Server erreicht.
2. Caddy dazu starten, der das HTTPS-Zertifikat holt: `docker compose -f deploy/compose.yaml up -d`.
3. `https://<deine Domain>` öffnen. Weitere Konten entstehen über Freigabe-Links oder, mit
   `SCHREIBZEUG_OPEN_SIGNUP=true` in `deploy/.env`, durch jeden.

Mit [Kontext](https://github.com/Speicherstadt/kontext) braucht Schreibzeug keine eigene Installation:
Es kommt mit Kontext als dessen Dokumente. Nur auf dem eigenen Rechner ausprobieren:
`docker run -d -p 127.0.0.1:3000:3000 -v schreibzeug-data:/data tristanteu/schreibzeug`, dann
http://localhost:3000. Einstellungen, ein eigener Reverse Proxy, Backups und Updates stehen in der
[Installationsanleitung](https://schreibzeug.app/installation.html).
Die Desktop-App beschreibt [Desktop-App](https://schreibzeug.app/desktop.html); ihre Installer für Windows, macOS und Linux hängen an jedem [Release](https://github.com/Speicherstadt/schreibzeug/releases).

Keinen eigenen Server oder keine eigene IT? Schreibzeug gibt es auf Anfrage gehostet oder über einen IT-Dienstleister aus dem [Partnerprogramm](https://speicherstadt.org/partner/).

## FAQ

<details>
<summary><b>Gibt es eine selbst gehostete Alternative zu Microsoft 365?</b></summary>

Ja. Schreibzeug läuft mit Docker auf deinem eigenen Server und bearbeitet Word-, Excel-, PowerPoint-
und PDF-Dateien im Browser, mehrere Leute gleichzeitig. Siehe [Installationsanleitung](https://schreibzeug.app/installation.html).
</details>

<details>
<summary><b>Braucht es einen ONLYOFFICE Document Server oder Nextcloud?</b></summary>

Nein. Die Euro-Office-Engine läuft im Browser, der Schreibzeug-Server speichert die Dateien und
reicht die Änderungen weiter; sonst ist nichts zu installieren. Wie das geht, steht unter [Engine](https://schreibzeug.app/engine.html).
</details>

<details>
<summary><b>Werden meine Dateien in ein anderes Format umgewandelt?</b></summary>

Nein. Eine .docx bleibt eine .docx, eine .xlsx eine .xlsx, eine .odt eine .odt; jedes Speichern ist
eine neue Version derselben Datei.
</details>

<details>
<summary><b>Kann ich Schreibzeug offline nutzen, ohne Server?</b></summary>

Ja, mit der Desktop-App für Windows, macOS und Linux: Sie öffnet die Dateien in deinem
Dokumente-Ordner direkt. Siehe [Desktop-App](https://schreibzeug.app/desktop.html).
</details>

<details>
<summary><b>Können Claude oder andere KI-Assistenten meine Dokumente bearbeiten?</b></summary>

Ja, über den eingebauten MCP-Server und einen persönlichen Zugangsschlüssel, den du in den
Einstellungen anlegst. Ein Schlüssel lässt sich auf „Nur lesen“ beschränken; Änderungen an einem
offenen Dokument brauchen deine Zustimmung und lassen sich rückgängig machen. Siehe [MCP-Server](https://schreibzeug.app/mcp.html).
</details>

<details>
<summary><b>Kann ich E-Rechnungen mit ZUGFeRD oder XRechnung erstellen?</b></summary>

ZUGFeRD ja: Eine Rechnung aus dem Texteditor wird ein ZUGFeRD-PDF/A-3 mit Factur-X-XML (EN 16931).
XRechnung wird gelesen und angezeigt, aber noch nicht erstellt. Siehe [E-Rechnungen](https://schreibzeug.app/e-invoice.html).
</details>

<details>
<summary><b>Ist das sicher?</b></summary>

Prüf es selbst, der Code ist offen: Lass deinen Agenten Cloudflares [Security Audit Skill](https://github.com/cloudflare/security-audit-skill) oder
`/security-review` von Claude Code über dieses Repository laufen.
Sicherheitslücken meldest du vertraulich, wie in [SECURITY.md](SECURITY.md) beschrieben.
</details>

## Dokumentation

Alles im Detail, mit Suche: **[schreibzeug.app](https://schreibzeug.app/)**. Jede Funktion oben verlinkt ihre Seite; dazu kommen:

- **Einstieg:** der [Rundgang in Bildern](https://schreibzeug.app/), gemacht zum Weiterschicken an Kunden,
  [jede Funktion im Detail](https://schreibzeug.app/overview.html), [Installation](https://schreibzeug.app/installation.html) und
  [Konten und Teilen](https://schreibzeug.app/accounts.html)
- **Hintergrund:** [gemeinsames Bearbeiten](https://schreibzeug.app/collaboration.html), [die Engine](https://schreibzeug.app/engine.html) und
  [Entwicklung](https://schreibzeug.app/development.html)
- **Releases:** das [Changelog](CHANGELOG.md) (Englisch), mit den Schritten, die ein Update braucht

## Entwicklung

[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh)
[![Hono](https://img.shields.io/badge/Hono-e36002?logo=hono&logoColor=white)](https://hono.dev)
[![React](https://img.shields.io/badge/React-149eca?logo=react&logoColor=white)](https://react.dev)
[![TanStack](https://img.shields.io/badge/TanStack-Router%20%7C%20Query-ff4154?logo=reactquery&logoColor=white)](https://tanstack.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vite](https://img.shields.io/badge/Vite-646cff?logo=vite&logoColor=white)](https://vite.dev)
[![SQLite](https://img.shields.io/badge/SQLite-Drizzle-003b57?logo=sqlite&logoColor=white)](https://orm.drizzle.team)
[![Tauri](https://img.shields.io/badge/Tauri-24c8db?logo=tauri&logoColor=white)](https://tauri.app)

Braucht [Bun](https://bun.sh) 1.4 oder neuer, unter Linux x86_64 zum Vorbereiten der Engine; die Datenbank ist eine SQLite-Datei.

```bash
git clone https://github.com/Speicherstadt/schreibzeug && cd schreibzeug
bun install
bun run dev              # http://localhost:5173, mit der API auf http://localhost:3000
```

Eine React-SPA mit TanStack Router und Query, Tailwind und Komponenten im Stil von shadcn; Euro-Office
`sdkjs` als Engine; ein Bun-Server mit Hono, Drizzle und SQLite; Tauri 3 (Alpha) für die Desktop-App.
Prüfungen, Tests und Architektur: [Entwicklung](https://schreibzeug.app/development.html).

## Mehr von uns

Weitere Open-Source-Apps für deinen eigenen Server, etwa für Mail, Buchhaltung, ein Dokumentenarchiv und mehr: **[speicherstadt.org](https://speicherstadt.org)**

## Mitwirken

Fehler und Ideen gern als Issue, mit dem [Formular für Fehlerberichte](https://github.com/Speicherstadt/schreibzeug/issues/new?template=bug_report.yml); Pull Requests sind ebenso willkommen. Bei einem Darstellungs- oder Kompatibilitätsfehler bitte
eine Datei anhängen, die ihn zeigt (oder eine kleine, die ihn nachstellt), und sagen, welches
Programm sie erstellt hat. Vor einem Pull Request bitte
`bun run lint && bun run typecheck && bun run test` ausführen; die Prüfungen, Konventionen und wie
Beiträge lizenziert werden, stehen in [CONTRIBUTING.md](CONTRIBUTING.md) (Englisch).
Sicherheitslücken bitte vertraulich melden ([SECURITY.md](SECURITY.md)).

## Sterne im Verlauf

<a href="https://www.star-history.com/#Speicherstadt/schreibzeug&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Speicherstadt/schreibzeug&type=Date&theme=dark">
    <img alt="Verlauf der GitHub-Sterne von Schreibzeug" src="https://api.star-history.com/svg?repos=Speicherstadt/schreibzeug&type=Date">
  </picture>
</a>

---

<div align="center">

⭐ **Gefällt dir Schreibzeug?** Ein [Stern auf GitHub](https://github.com/Speicherstadt/schreibzeug) hilft anderen, es zu finden.

[Fehler melden](https://github.com/Speicherstadt/schreibzeug/issues/new?template=bug_report.yml) &nbsp;·&nbsp; [Funktion vorschlagen](https://github.com/Speicherstadt/schreibzeug/issues/new?template=feature_request.yml)

<sub>Lizenz: <a href="LICENSE">AGPL-3.0</a> · © Tristan Teufel und Mitwirkende<br>
Wer eine veränderte Version weitergibt oder für andere betreibt, muss ihren Quellcode unter der AGPL anbieten.<br>
Für IT-Dienstleister und Hoster: <a href="https://speicherstadt.org/partner/">Partnerprogramm</a>.<br>
Schreibzeug baut auf der Open-Source-Engine Euro-Office auf und steht in keiner Verbindung zu Euro-Office, ONLYOFFICE, Collabora, CryptPad, Microsoft oder Google; die Namen sind Marken ihrer Inhaber.</sub>

</div>
