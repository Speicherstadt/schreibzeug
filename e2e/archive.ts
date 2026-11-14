/**
 * Another app that hands files over by a link (fake-archive.ts), as an archive with "Öffnen mit
 * Schreibzeug" does; the E2E server may fetch from it (SCHREIBZEUG_IMPORT_ORIGINS in server.ts).
 */
export const E2E_ARCHIVE_PORT = 3500;
export const E2E_ARCHIVE_URL = `http://localhost:${E2E_ARCHIVE_PORT}`;

/** What the archive's link to a note serves. */
export const ARCHIVE_NOTE = "# Protokoll\n\nAus dem Archiv geholt.\n";
