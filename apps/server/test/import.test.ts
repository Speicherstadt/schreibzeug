import { type FileNode, folderListingSchema, nodeSchema } from "@schreibzeug/files-api";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dispositionName, importName } from "../src/files/import";
import { MAX_UPLOAD_BYTES, startServer, type TestServer } from "./harness";

/**
 * Another app's links, served by a Bun server on a free port: a file, links that expired or whose
 * file was deleted, a redirect, files too large, an error and an answer that never comes.
 */
const NOTE = "# Protokoll\n\nAus dem Archiv.\n";
let hits: string[] = [];
const upstream = Bun.serve({
  port: 0,
  fetch: (request) => {
    const { pathname } = new URL(request.url);
    hits.push(pathname);
    switch (pathname) {
      case "/freigabe/note":
        return new Response(NOTE, {
          headers: {
            "content-type": "text/markdown; charset=utf-8",
            "content-disposition": "attachment; filename*=UTF-8''Protokoll%20M%C3%A4rz.md",
            "cache-control": "no-store",
          },
        });
      case "/freigabe/unnamed":
        return new Response(NOTE, { headers: { "content-type": "text/markdown" } });
      case "/freigabe/expired":
        return new Response("not found", { status: 404 });
      case "/freigabe/deleted":
        return new Response("gone", { status: 410 });
      case "/freigabe/moved":
        return new Response(null, { status: 302, headers: { location: "/freigabe/note" } });
      case "/freigabe/broken":
        return new Response("oops", { status: 500 });
      case "/freigabe/large":
        return new Response(new Uint8Array(MAX_UPLOAD_BYTES + 1));
      case "/freigabe/large-stream":
        // No Content-Length: only counting the bytes notices.
        return new Response(
          new ReadableStream({
            start: (controller) => {
              for (let i = 0; i < 3; i += 1) controller.enqueue(new Uint8Array(MAX_UPLOAD_BYTES / 2));
              controller.close();
            },
          }),
        );
      case "/freigabe/slow":
        return new Promise<Response>(() => {});
      default:
        return new Response("?", { status: 404 });
    }
  },
});
const origin = `http://localhost:${upstream.port}`;
const linkTo = (path: string, base = origin) => `${base}/freigabe/${path}`;

let server: TestServer;
let cookie: string;
beforeAll(async () => {
  // A closed port beside the archive: allowed, but nobody answers there.
  server = await startServer({ importOrigins: [origin, "http://localhost:1"], importTimeoutMs: 500 });
  cookie = await server.signUp("Anna");
});
afterAll(async () => {
  upstream.stop(true);
  await server?.stop();
});
beforeEach(() => {
  hits = [];
});

const importFile = (body: Record<string, unknown>, on = server, as = cookie) =>
  on.app.request("/api/files/import", {
    method: "POST",
    headers: { cookie: as, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const expectNode = async (response: Response): Promise<FileNode> => {
  const body = await response.text();
  expect(response.status, body).toBe(201);
  return nodeSchema.parse(JSON.parse(body));
};

const expectError = async (response: Response, status: number, kind: string) => {
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ error: { kind } });
};

const contentOf = async (id: string, as = cookie) =>
  (await server.app.request(`/api/files/${id}/content`, { headers: { cookie: as } })).text();

describe("POST /files/import", () => {
  it("stores a copy of the linked file as a new file of the user", async () => {
    const node = await expectNode(await importFile({ url: linkTo("note"), name: "Protokoll.md" }));
    expect(node).toMatchObject({ name: "Protokoll.md", kind: "file", role: "owner", parentId: null });
    expect(node.mime).toBe("text/markdown");
    expect(node.size).toBe(new TextEncoder().encode(NOTE).byteLength);
    expect(await contentOf(node.id)).toBe(NOTE);
    expect(hits).toEqual(["/freigabe/note"]);

    // Only its owner sees it.
    const other = await server.signUp("Bert");
    const listing = await server.app.request("/api/nodes?parent=root", { headers: { cookie: other } });
    expect(folderListingSchema.parse(await listing.json()).children).toEqual([]);
    expect((await server.app.request(`/api/nodes/${node.id}`, { headers: { cookie: other } })).status).toBe(
      404,
    );
  });

  it("numbers a name that is taken", async () => {
    const first = await expectNode(await importFile({ url: linkTo("note"), name: "Doppelt.md" }));
    const second = await expectNode(await importFile({ url: linkTo("note"), name: "Doppelt.md" }));
    const third = await expectNode(await importFile({ url: linkTo("note"), name: "doppelt.md" }));
    expect([first.name, second.name, third.name]).toEqual(["Doppelt.md", "Doppelt (2).md", "doppelt (3).md"]);
  });

  it("takes the name from Content-Disposition when none or no valid one is asked for", async () => {
    const node = await expectNode(await importFile({ url: linkTo("note"), name: "a/b:c.md" }));
    expect(node.name).toBe("Protokoll März.md");
    const unnamed = await expectNode(await importFile({ url: linkTo("unnamed") }));
    expect(unnamed.name).toBe("Datei.md");
  });

  it("puts the file into a folder the user may change", async () => {
    const folder = nodeSchema.parse(
      await (
        await server.app.request("/api/folders", {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ name: "Aus dem Archiv", parentId: null }),
        })
      ).json(),
    );
    const node = await expectNode(await importFile({ url: linkTo("note"), parentId: folder.id }));
    expect(node.parentId).toBe(folder.id);
  });

  it("fetches only from the allowed origins, and nothing without them", async () => {
    // The same server under another origin is not allowed.
    const sameHost = `http://127.0.0.1:${upstream.port}`;
    for (const url of [
      linkTo("note", sameHost),
      "https://example.org/freigabe/note",
      `file:///etc/passwd`,
      `http://user:secret@localhost:${upstream.port}/freigabe/note`,
      "not a link",
    ]) {
      await expectError(await importFile({ url }), 403, "forbidden");
    }
    expect(hits).toEqual([]);

    const closed = await startServer();
    try {
      const other = await closed.signUp("Clara");
      await expectError(await importFile({ url: linkTo("note") }, closed, other), 404, "not_found");
      expect(hits).toEqual([]);
    } finally {
      await closed.stop();
    }
  });

  it("does not follow a redirect", async () => {
    await expectError(await importFile({ url: linkTo("moved") }), 502, "upstream_failed");
    expect(hits).toEqual(["/freigabe/moved"]);
  });

  it("tells an expired link or a deleted file from a server that fails", async () => {
    await expectError(await importFile({ url: linkTo("expired") }), 410, "link_expired");
    await expectError(await importFile({ url: linkTo("deleted") }), 410, "link_expired");
    await expectError(await importFile({ url: linkTo("broken") }), 502, "upstream_failed");
    await expectError(await importFile({ url: "http://localhost:1/freigabe/x" }), 502, "upstream_failed");
    await expectError(await importFile({ url: linkTo("slow") }), 502, "upstream_failed");
  });

  it("refuses a file over the upload limit, with or without Content-Length", async () => {
    await expectError(await importFile({ url: linkTo("large") }), 413, "too_large");
    await expectError(await importFile({ url: linkTo("large-stream") }), 413, "too_large");
  });

  it("needs a session or a token that may write", async () => {
    await expectError(await importFile({ url: linkTo("note") }, server, ""), 401, "unauthorized");
    expect(hits).toEqual([]);
  });
});

describe("dispositionName", () => {
  it("prefers filename* and decodes it", () => {
    expect(
      dispositionName(`attachment; filename="Bericht.docx"; filename*=UTF-8''Bericht%20%C3%BC.docx`),
    ).toBe("Bericht ü.docx");
    expect(dispositionName("attachment; filename*=iso-8859-1'de'Gr%FC%DFe.txt")).toBe("Grüße.txt");
  });

  it("falls back to filename, quoted or not", () => {
    expect(dispositionName('attachment; filename="Ein \\"Plan\\".md"')).toBe('Ein "Plan".md');
    expect(dispositionName("attachment; filename=plan.md")).toBe("plan.md");
    expect(dispositionName("attachment")).toBeUndefined();
    expect(dispositionName(null)).toBeUndefined();
  });
});

describe("importName", () => {
  const answer = { contentType: "application/pdf", disposition: "attachment; filename=Scan.pdf" };

  it("takes the name asked for, else the answer's, else a fallback", () => {
    expect(importName("Rechnung.pdf", answer)).toBe("Rechnung.pdf");
    expect(importName("", answer)).toBe("Scan.pdf");
    expect(importName(undefined, { ...answer, disposition: "attachment; filename=../../etc/Scan.pdf" })).toBe(
      "Scan.pdf",
    );
    expect(importName(undefined, { contentType: null, disposition: null })).toBe("Datei");
  });

  it("adds the extension of the type to a name without a known one", () => {
    expect(importName("Rechnung", answer)).toBe("Rechnung.pdf");
    expect(importName("Rechnung.docx", answer)).toBe("Rechnung.docx");
  });
});
