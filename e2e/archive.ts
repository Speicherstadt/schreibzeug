/**
 * Another app that hands files over by a link (fake-archive.ts), as an archive with "Öffnen mit
 * Schreibzeug" does; the E2E server may fetch from it (SCHREIBZEUG_IMPORT_ORIGINS in server.ts).
 * Documents saved to the archive go to it too (SCHREIBZEUG_ARCHIVE_URL, save-to-archive.spec.ts).
 */
export const E2E_ARCHIVE_PORT = 3500;
export const E2E_ARCHIVE_URL = `http://localhost:${E2E_ARCHIVE_PORT}`;

/** The archive's API token the E2E server sends; the stand-in refuses any other. */
export const E2E_ARCHIVE_TOKEN = "belegt_e2e-stand-in-token";

/** What the E2E server calls the archive (SCHREIBZEUG_ARCHIVE_NAME). */
export const E2E_ARCHIVE_NAME = "Belegablage";

/** A file whose name contains this is refused with 401, as with a token the archive no longer takes. */
export const E2E_ARCHIVE_REFUSES = "Abgelehnt";

/** What the archive's link to a note serves. */
export const ARCHIVE_NOTE = "# Protokoll\n\nAus dem Archiv geholt.\n";
