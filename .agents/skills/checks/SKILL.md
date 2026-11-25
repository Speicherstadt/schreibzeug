---
name: checks
description: "Prüfungen von Schreibzeug ausführen (Typen, Texte der Oberfläche, Lint, Vitest, Playwright, Build, Desktop, Doku). Vor jedem Push, im Review und wenn Bun, die Engine oder ein Werkzeug für die Tests fehlt."
---

# Prüfungen

Vor jedem Push grün, danach die CI prüfen. Die volle E2E-Suite läuft in der CI (drei Shards); vor dem Push nur die
Specs, die die Änderung abdecken, und das Projekt `fidelity`, wenn sich die Engine, die Frame-Seiten oder der
Konverter geändert haben.

Voraussetzung: Bun 1.4 oder neuer, Linux x86_64. `bun run engine:prepare` einmal vor dem ersten Dev-Server oder
E2E-Lauf und nach jeder Änderung in `engine/` (lädt rund 630 MB, braucht `ar`, `tar -xJ`, `unzip`; Details in
`docs/development.md`).

```sh
bun install --frozen-lockfile
bun run typecheck        # tsc in jedem Workspace
bun run i18n:check       # jeder Text der Oberfläche in de.json und en.json, keiner im Code
bun run lint             # Biome und checks (Dateigröße, Zyklen, Texte)
bun run test             # Vitest auf Bun: Unit und Integration (SQLite, docs/files.md)
bun run test:e2e e2e/<spec>.ts   # Playwright: die berührten Specs, oder -g "<test>"; alle laufen in der CI
bun run test:fidelity    # wenn Engine, Frame-Seiten oder Konverter geändert sind
bun run build
```

Wenn sich `apps/desktop` geändert hat, in `apps/desktop/src-tauri`:

```sh
cargo fmt --check && cargo clippy -- -D warnings && cargo test
```

Wenn sich `docs/` oder `mkdocs.yml` geändert haben (`pip install -r requirements-docs.txt`):

```sh
zensical build --strict
```

Die Regeln am Pull Request selbst (Titel, `Umgesetzt`/`Refs`, neue Abhängigkeiten, lange Funktionen) prüft vor dem
Push die Werkbank, siehe Skill `beitrag`.

Für Tests andere Ports nehmen als ein laufender Dev-Server; laufende Prozesse nicht stoppen. Was übersprungen wurde,
gehört mit Grund in die Beschreibung des Pull Requests, nie als bestanden.
