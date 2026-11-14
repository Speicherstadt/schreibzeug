/**
 * A stand-in for an archive that hands over files by short-lived links: `/freigabe/note` serves a
 * Markdown note as a download, `/freigabe/expired` answers 404 as a link past its time does. Started
 * by playwright.config.ts.
 *
 * E2E_ARCHIVE_PORT: set by playwright.config.ts.
 */
import { ARCHIVE_NOTE, E2E_ARCHIVE_PORT } from "./archive";

Bun.serve({
  port: Number(process.env.E2E_ARCHIVE_PORT ?? E2E_ARCHIVE_PORT),
  fetch: (request) => {
    const { pathname } = new URL(request.url);
    if (pathname === "/health") return new Response("ok");
    if (pathname === "/freigabe/note")
      return new Response(ARCHIVE_NOTE, {
        headers: {
          "content-type": "text/markdown; charset=utf-8",
          "content-disposition": "attachment; filename*=UTF-8''Protokoll.md",
          "cache-control": "no-store",
        },
      });
    return new Response("not found", { status: 404 });
  },
});
