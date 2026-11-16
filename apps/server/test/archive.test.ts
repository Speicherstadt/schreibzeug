import { archivedSchema, type FileNode, nodeSchema, versionSchema } from "@schreibzeug/files-api";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, startServer, type TestServer } from "./harness";

/**
 * A stand-in archive on a free port, answering `POST /api/dokumente` as the archive does (201 with
 * the new document as JSON) unless a test sets another answer; beside it a second server that
 * must never be reached, the target of a redirect.
 */
const TOKEN = "belegt_7f3a9c-very-secret-token";

type Received = {
  path: string;
  headers: Record<string, string>;
  name: string;
  type: string;
  bytes: Uint8Array;
};
let received: Received[] = [];
let answer: (request: Request, count: number) => Response | Promise<Response> = () =>
  Response.json({ id: crypto.randomUUID(), sha256: "…" }, { status: 201 });

const archiveServer = Bun.serve({
  port: 0,
  fetch: async (request) => {
    const form = await request.formData().catch(() => null);
    const file = form?.get("datei");
    received.push({
      path: new URL(request.url).pathname,
      headers: Object.fromEntries(request.headers),
      name: file instanceof File ? file.name : "",
      type: file instanceof File ? file.type : "",
      bytes: file instanceof File ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array(),
    });
    return answer(request, received.length);
  },
});
let elsewhereHits: Request[] = [];
const elsewhere = Bun.serve({
  port: 0,
  fetch: (request) => {
    elsewhereHits.push(request);
    return Response.json({ id: "stolen" }, { status: 201 });
  },
});
const archiveUrl = `http://localhost:${archiveServer.port}`;

/** Everything the server answered or logged, searched for the token at the end. */
const seen: string[] = [];
const logged: string[] = [];

let server: TestServer;
let unconfigured: TestServer;
let unreachable: TestServer;
let owner: string;
let viewer: string;
beforeAll(async () => {
  server = await startServer({
    archive: { url: archiveUrl, token: TOKEN, name: "Belegablage" },
    archiveTimeoutMs: 500,
    log: (message, detail) => logged.push(`${message} ${String(detail)}`),
  });
  unconfigured = await startServer();
  // Nobody answers on port 1.
  unreachable = await startServer({ archive: { url: "http://localhost:1", token: TOKEN, name: undefined } });
  owner = await server.signUp("Olga");
  viewer = await server.signUp("Vik");
});
afterAll(async () => {
  archiveServer.stop(true);
  elsewhere.stop(true);
  await Promise.all([server?.stop(), unconfigured?.stop(), unreachable?.stop()]);
});
beforeEach(() => {
  received = [];
  elsewhereHits = [];
  answer = () => Response.json({ id: crypto.randomUUID(), sha256: "…" }, { status: 201 });
});

const PDF = new TextEncoder().encode("%PDF-2.0\n% a stand-in for a PDF/A\n%%EOF\n");
const DOCX = new TextEncoder().encode("PK… stands in for the Office file");

const call = async (on: TestServer, path: string, cookie: string, init: RequestInit = {}) => {
  const response = await on.app.request(path, { ...init, headers: { cookie, ...init.headers } });
  seen.push(JSON.stringify([...response.headers]), await response.clone().text());
  return response;
};

const upload = async (name = "Angebot.docx", on = server, cookie = owner): Promise<FileNode> => {
  const form = new FormData();
  form.append("file", new File([DOCX], name));
  const reply = await call(on, "/api/files", cookie, { method: "POST", body: form });
  expect(reply.status).toBe(201);
  return nodeSchema.parse(await reply.json());
};

const archive = (
  file: FileNode,
  { pdf = PDF as Uint8Array | null, original = false, version = file.version ?? 1 } = {},
  { on = server, cookie = owner } = {},
) => {
  const form = new FormData();
  if (pdf)
    form.append("pdf", new File([pdf as Uint8Array<ArrayBuffer>], "egal.pdf", { type: "application/pdf" }));
  if (original) form.append("original", "true");
  form.append("version", String(version));
  return call(on, `/api/files/${file.id}/archive`, cookie, { method: "POST", body: form });
};

const expectError = async (response: Response, status: number, kind: string) => {
  expect(response.status).toBe(status);
  const body = (await response.json()) as { error: { kind: string; message: string } };
  expect(body).toMatchObject({ error: { kind } });
  return body.error.message;
};

const keptOf = async (file: FileNode) =>
  versionSchema
    .array()
    .parse(await (await call(server, `/api/files/${file.id}/versions`, owner)).json())
    .find((version) => version.number === file.version)?.kept;

describe("POST /files/:id/archive", () => {
  it("sends the PDF to the archive and answers its id and page", async () => {
    const file = await upload();
    const reply = await archive(file);
    expect(reply.status).toBe(201);
    const { version, documents } = archivedSchema.parse(await reply.json());
    expect(version).toBe(file.version);
    expect(documents).toHaveLength(1);
    const [document] = documents;
    expect(document).toMatchObject({ kind: "pdf", name: "Angebot.pdf" });
    expect(document?.url).toBe(`${archiveUrl}/dokumente/${document?.id}`);

    expect(received).toHaveLength(1);
    const [sent] = received;
    expect(sent?.path).toBe("/api/dokumente");
    expect(sent?.name).toBe("Angebot.pdf");
    expect(sent?.type).toBe("application/pdf");
    expect(sent?.bytes).toEqual(PDF);
  });

  it("sends the token to the configured archive only, in the Authorization header", async () => {
    await archive(await upload("Token.docx"));
    const [sent] = received;
    expect(sent?.headers.authorization).toBe(`Bearer ${TOKEN}`);
    const elsewhereInRequest = Object.entries(sent?.headers ?? {}).filter(
      ([name, value]) => name !== "authorization" && value.includes(TOKEN),
    );
    expect(elsewhereInRequest).toEqual([]);
    expect(sent?.path).not.toContain(TOKEN);
  });

  it("keeps the version that went to the archive", async () => {
    const file = await upload("Behalten.docx");
    expect(await keptOf(file)).toBe(false);
    expect((await archive(file)).status).toBe(201);
    expect(await keptOf(file)).toBe(true);
  });

  it("sends the original file too when asked, as the version's bytes", async () => {
    const file = await upload("Vertrag.docx");
    const reply = await archive(file, { original: true });
    expect(reply.status).toBe(201);
    const { documents } = archivedSchema.parse(await reply.json());
    expect(documents.map((document) => [document.kind, document.name])).toEqual([
      ["pdf", "Vertrag.pdf"],
      ["original", "Vertrag.docx"],
    ]);
    expect(received.map((sent) => sent.name)).toEqual(["Vertrag.pdf", "Vertrag.docx"]);
    expect(received[1]?.type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(received[1]?.bytes).toEqual(DOCX);
    expect(new Set(documents.map((document) => document.id)).size).toBe(2);
  });

  it("sends only the original when no PDF comes", async () => {
    const file = await upload("Nur Original.docx");
    const reply = await archive(file, { pdf: null, original: true });
    expect(reply.status).toBe(201);
    expect(received.map((sent) => sent.name)).toEqual(["Nur Original.docx"]);
  });

  it("refuses nothing to send, and what is no PDF, before it sends anything", async () => {
    const file = await upload("Leer.docx");
    await expectError(await archive(file, { pdf: null }), 400, "invalid");
    await expectError(
      await archive(file, { pdf: new TextEncoder().encode("<html></html>") }),
      400,
      "invalid",
    );
    expect(received).toEqual([]);
  });

  it("refuses a PDF larger than the upload limit", async () => {
    const file = await upload("Groß.docx");
    const large = new Uint8Array(MAX_UPLOAD_BYTES + 128 * 1024);
    large.set(PDF);
    await expectError(await archive(file, { pdf: large }), 413, "too_large");
    expect(received).toEqual([]);
  });

  it("answers 404 and sends nothing without an archive set up", async () => {
    const cookie = await unconfigured.signUp("Ohne");
    const file = await upload("Ohne.docx", unconfigured, cookie);
    await expectError(await archive(file, {}, { on: unconfigured, cookie }), 404, "not_found");
    expect(received).toEqual([]);
  });

  it("tells the web app whether there is an archive and its name, nothing else", async () => {
    const info = await (await call(server, "/api/info", "")).json();
    expect(info).toEqual({ mode: "server", archive: { name: "Belegablage" } });
    expect(await (await call(unconfigured, "/api/info", "")).json()).toEqual({ mode: "server" });
  });

  it("needs edit on the file: a viewer gets 403, a stranger 404", async () => {
    const file = await upload("Geteilt.docx");
    await call(server, `/api/nodes/${file.id}/shares`, owner, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "vik@example.org", role: "view" }),
    });
    await expectError(await archive(file, {}, { cookie: viewer }), 403, "forbidden");
    const stranger = await server.signUp("Fremd");
    await expectError(await archive(file, {}, { cookie: stranger }), 404, "not_found");
    expect(received).toEqual([]);
  });

  it("refuses a PDF of a version that is no longer the newest", async () => {
    const file = await upload("Weiter.docx");
    await call(server, `/api/files/${file.id}/content`, owner, { method: "PUT", body: "zwei" });
    await expectError(await archive(file, { version: 1 }), 409, "conflict");
    expect(received).toEqual([]);
  });

  it("says the archive refused the token on 401 and 403, and keeps nothing", async () => {
    for (const status of [401, 403]) {
      answer = () => Response.json({ fehler: "Token ungültig" }, { status });
      const file = await upload(`Abgelehnt ${status}.docx`);
      const message = await expectError(await archive(file), 502, "upstream_refused");
      expect(message).toContain("Verwaltung");
      expect(await keptOf(file)).toBe(false);
    }
  });

  it("passes on that the archive found the file too large", async () => {
    answer = () => Response.json({ fehler: "Datei zu groß" }, { status: 413 });
    await expectError(await archive(await upload("Zu groß.docx")), 413, "too_large");
  });

  it("does not follow a redirect, so the token reaches no other host", async () => {
    answer = () =>
      new Response(null, {
        status: 307,
        headers: { location: `http://localhost:${elsewhere.port}/api/dokumente` },
      });
    await expectError(await archive(await upload("Umleitung.docx")), 502, "upstream_failed");
    expect(received).toHaveLength(1);
    expect(elsewhereHits).toEqual([]);
  });

  it("fails on an answer without a document id", async () => {
    for (const reply of [
      () => new Response("<html>Anmelden</html>", { status: 200, headers: { "content-type": "text/html" } }),
      () => Response.json({ ok: true }, { status: 201 }),
      () => new Response("kaputt", { status: 500 }),
    ]) {
      answer = reply;
      await expectError(
        await archive(await upload(`Ohne Id ${crypto.randomUUID()}.docx`)),
        502,
        "upstream_failed",
      );
    }
  });

  it("gives up on an archive that does not answer in time", async () => {
    answer = () => new Promise<Response>(() => {});
    const started = Date.now();
    await expectError(await archive(await upload("Langsam.docx")), 502, "upstream_failed");
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("fails when the archive cannot be reached", async () => {
    const cookie = await unreachable.signUp("Weg");
    const file = await upload("Weg.docx", unreachable, cookie);
    await expectError(await archive(file, {}, { on: unreachable, cookie }), 502, "upstream_failed");
  });

  it("says the PDF is in the archive when the original then fails, and keeps the version", async () => {
    answer = (_request, count) =>
      count === 1
        ? Response.json({ id: "pdf-1" }, { status: 201 })
        : Response.json({ fehler: "nein" }, { status: 401 });
    const file = await upload("Halb.docx");
    const message = await expectError(await archive(file, { original: true }), 502, "upstream_refused");
    expect(message).toContain("Das PDF liegt im Archiv");
    expect(await keptOf(file)).toBe(true);
  });

  it("never shows the token in an answer or the log", () => {
    // Runs last: every answer above and everything logged.
    expect(seen.length).toBeGreaterThan(20);
    expect(logged.length).toBeGreaterThan(0);
    expect(seen.filter((text) => text.includes(TOKEN))).toEqual([]);
    expect(logged.filter((text) => text.includes(TOKEN))).toEqual([]);
  });
});
