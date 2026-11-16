/**
 * A stand-in for an archive that hands over files by short-lived links: `/freigabe/note` serves a
 * Markdown note as a download, `/freigabe/expired` answers 404 as a link past its time does. It
 * also takes documents as the archive's `POST /api/dokumente` does (multipart field `datei`,
 * `Authorization: Bearer <token>`, `201` with the document as JSON), keeps them in memory, shows
 * each at `/dokumente/<id>`, describes it at `/api/dokumente/<id>` and serves it at
 * `/api/dokumente/<id>/datei`. Started by
 * playwright.config.ts.
 *
 * E2E_ARCHIVE_PORT: set by playwright.config.ts.
 */
import { ARCHIVE_NOTE, E2E_ARCHIVE_PORT, E2E_ARCHIVE_REFUSES, E2E_ARCHIVE_TOKEN } from "./archive";

type Stored = { id: string; name: string; type: string; size: number; pdf: boolean };
const documents = new Map<string, Stored>();
const contents = new Map<string, Uint8Array>();

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (character) => `&#${character.charCodeAt(0)};`);

const take = async (request: Request): Promise<Response> => {
  if (request.headers.get("authorization") !== `Bearer ${E2E_ARCHIVE_TOKEN}`)
    return Response.json({ fehler: "Nicht angemeldet" }, { status: 401 });
  const file = (await request.formData()).get("datei");
  if (!(file instanceof File)) return Response.json({ fehler: "Feld „datei“ fehlt" }, { status: 400 });
  if (file.name.includes(E2E_ARCHIVE_REFUSES))
    return Response.json({ fehler: "Token widerrufen" }, { status: 401 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const stored: Stored = {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    size: bytes.byteLength,
    pdf: new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-",
  };
  documents.set(stored.id, stored);
  contents.set(stored.id, bytes);
  return Response.json({ id: stored.id, sha256: "", dateiname: stored.name }, { status: 201 });
};

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
    if (pathname === "/api/dokumente" && request.method === "POST") return take(request);
    const file = contents.get(/^\/api\/dokumente\/([0-9a-f-]{36})\/datei$/.exec(pathname)?.[1] ?? "");
    if (file) return new Response(file as BlobPart);
    const page = /^\/(api\/)?dokumente\/([0-9a-f-]{36})$/.exec(pathname);
    const found = page && documents.get(page[2] ?? "");
    if (found && page?.[1]) return Response.json(found);
    if (found)
      return new Response(`<!doctype html><title>Archiv</title><h1>${escapeHtml(found.name)}</h1>`, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    return new Response("not found", { status: 404 });
  },
});
