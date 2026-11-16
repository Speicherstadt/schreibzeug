import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { withArchive } from "../src/app";
import { createBlobStore, sha256Of } from "../src/blobs";
import { readConfig } from "../src/config";
import { checkPdf, documentPage, isPdf, requireArchive } from "../src/files/archive";
import { pdfNameOf } from "../src/files/archive-routes";
import { mimeOf } from "../src/files/mime";
import { contentDisposition } from "../src/files/serialize";

describe("blob store", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });
  const store = async () => {
    const dir = await mkdtemp(join(tmpdir(), "schreibzeug-blob-test-"));
    dirs.push(dir);
    return { dir, blobs: createBlobStore(dir) };
  };

  it("keys bytes by their SHA-256 and reads them back", async () => {
    const { blobs } = await store();
    const bytes = new TextEncoder().encode("Schreibzeug");
    const key = await blobs.put(bytes);
    expect(key).toBe(sha256Of(bytes));
    expect(await blobs.get(key)).toEqual(bytes);
  });

  it("writes the same bytes once and leaves no temporary files", async () => {
    const { dir, blobs } = await store();
    const bytes = new Uint8Array([1, 2, 3]);
    const key = await blobs.put(bytes);
    await blobs.put(bytes);
    expect(await readdir(dir)).toEqual([key.slice(0, 2)]);
    expect(await readdir(join(dir, key.slice(0, 2)))).toEqual([key]);
  });

  it("refuses keys that are not hashes", async () => {
    const { blobs } = await store();
    await expect(blobs.get("../../etc/passwd")).rejects.toThrow("not a blob key");
  });
});

describe("mimeOf", () => {
  it("goes by the extension, ignoring case", () => {
    expect(mimeOf("Bericht.DOCX")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(mimeOf("tabelle.xlsx")).toContain("spreadsheetml");
    expect(mimeOf("folien.pptx")).toContain("presentationml");
  });

  it("falls back for unknown and missing extensions", () => {
    expect(mimeOf("archiv.xyz")).toBe("application/octet-stream");
    expect(mimeOf("README")).toBe("application/octet-stream");
    expect(mimeOf(".docx")).toBe("application/octet-stream");
  });
});

describe("contentDisposition", () => {
  it("keeps quotes out of the plain name", () => {
    expect(contentDisposition('a"b.docx')).toBe(
      `attachment; filename="a_b.docx"; filename*=UTF-8''a%22b.docx`,
    );
  });
});

describe("readConfig", () => {
  it("has defaults for development", () => {
    expect(readConfig({})).toEqual({
      ok: true,
      value: {
        dataDir: "data",
        port: 3000,
        maxUploadBytes: 512 * 1024 * 1024,
        authSecret: undefined,
        openSignup: false,
        trustedOrigins: [],
        trustedProxies: [],
        versionPolicy: "thin",
        importOrigins: [],
      },
    });
  });

  it("reads the origins whose links may be fetched, and refuses what is no origin", () => {
    expect(
      readConfig({ SCHREIBZEUG_IMPORT_ORIGINS: "https://archive.example.org, http://localhost:8080/" }),
    ).toMatchObject({
      ok: true,
      value: { importOrigins: ["https://archive.example.org", "http://localhost:8080"] },
    });
    for (const wrong of [
      "archive.example.org",
      "https://archive.example.org/api",
      "file:///etc",
      "ftp://x.org",
    ]) {
      const config = readConfig({ SCHREIBZEUG_IMPORT_ORIGINS: wrong });
      expect(config.ok ? "" : config.error).toContain("SCHREIBZEUG_IMPORT_ORIGINS");
    }
  });

  it("keeps every version when asked to, and refuses another policy", () => {
    expect(readConfig({ SCHREIBZEUG_VERSIONS: "all" })).toMatchObject({
      ok: true,
      value: { versionPolicy: "all" },
    });
    expect(readConfig({ SCHREIBZEUG_VERSIONS: "none" }).ok).toBe(false);
  });

  it("reads the proxies in front of the server, and refuses what is no address", () => {
    expect(readConfig({ SCHREIBZEUG_TRUSTED_PROXIES: "127.0.0.1, 172.16.0.0/12, ::1" })).toMatchObject({
      ok: true,
      value: { trustedProxies: ["127.0.0.1", "172.16.0.0/12", "::1"] },
    });
    for (const wrong of ["proxy.local", "10.0.0.0/33", "10.0.0.1/8/1"]) {
      const config = readConfig({ SCHREIBZEUG_TRUSTED_PROXIES: wrong });
      expect(config.ok ? "" : config.error).toContain("SCHREIBZEUG_TRUSTED_PROXIES");
    }
  });

  it("reads the account settings", () => {
    const config = readConfig({
      SCHREIBZEUG_AUTH_SECRET: "x".repeat(32),
      SCHREIBZEUG_OPEN_SIGNUP: "true",
      SCHREIBZEUG_TRUSTED_ORIGINS: "tauri://localhost, https://office.example.org",
    });
    expect(config).toMatchObject({
      ok: true,
      value: {
        authSecret: "x".repeat(32),
        openSignup: true,
        trustedOrigins: ["tauri://localhost", "https://office.example.org"],
      },
    });
    expect(readConfig({ SCHREIBZEUG_AUTH_SECRET: "short" }).ok).toBe(false);
  });

  it("reads the sign-in through Kontext and the frame", () => {
    const config = readConfig({
      SCHREIBZEUG_URL: "https://dokumente.example.org/",
      SCHREIBZEUG_EMBED_ORIGIN: "https://kontext.example.org/mail",
      OIDC_ISSUER: "https://kontext.example.org/api/auth",
      OIDC_CLIENT_ID: "schreibzeug",
      OIDC_CLIENT_SECRET: "geheim",
    });
    expect(config).toMatchObject({
      ok: true,
      value: {
        publicUrl: "https://dokumente.example.org",
        embedOrigin: "https://kontext.example.org",
        oidc: {
          issuer: "https://kontext.example.org/api/auth",
          clientId: "schreibzeug",
          clientSecret: "geheim",
          name: "Kontext",
        },
      },
    });
    // Without all three, email and password only; an empty address counts as none.
    expect(
      readConfig({ OIDC_ISSUER: "https://kontext.example.org/api/auth", SCHREIBZEUG_URL: "" }),
    ).toMatchObject({
      ok: true,
      value: { oidc: undefined, publicUrl: undefined },
    });
  });

  it("needs the public address for the sign-in through Kontext", () => {
    const config = readConfig({
      OIDC_ISSUER: "https://kontext.example.org/api/auth",
      OIDC_CLIENT_ID: "schreibzeug",
      OIDC_CLIENT_SECRET: "geheim",
    });
    expect(config.ok).toBe(false);
    expect(config.ok ? "" : config.error).toContain("SCHREIBZEUG_URL");
  });

  it("reads the archive's address, token and name, all or nothing", () => {
    expect(
      readConfig({
        SCHREIBZEUG_ARCHIVE_URL: "https://archive.example.org/",
        SCHREIBZEUG_ARCHIVE_TOKEN: "belegt_abc123",
        SCHREIBZEUG_ARCHIVE_NAME: " Belegablage ",
      }),
    ).toMatchObject({
      ok: true,
      value: {
        archive: { url: "https://archive.example.org", token: "belegt_abc123", name: "Belegablage" },
      },
    });
    // Empty variables count as unset, as a compose file leaves them.
    expect(
      readConfig({
        SCHREIBZEUG_ARCHIVE_URL: "",
        SCHREIBZEUG_ARCHIVE_TOKEN: "",
        SCHREIBZEUG_ARCHIVE_NAME: "",
      }),
    ).toMatchObject({ ok: true, value: { archive: undefined } });
    expect(
      readConfig({ SCHREIBZEUG_ARCHIVE_URL: "https://archive.example.org", SCHREIBZEUG_ARCHIVE_TOKEN: "t" }),
    ).toMatchObject({ ok: true, value: { archive: { name: undefined } } });
  });

  it("refuses half an archive setup and a wrong address or token, never naming the token", () => {
    const urlOnly = readConfig({ SCHREIBZEUG_ARCHIVE_URL: "https://archive.example.org" });
    expect(urlOnly.ok ? "" : urlOnly.error).toContain("SCHREIBZEUG_ARCHIVE_TOKEN");
    const tokenOnly = readConfig({ SCHREIBZEUG_ARCHIVE_TOKEN: "belegt_secret-value" });
    expect(tokenOnly.ok ? "" : tokenOnly.error).toContain("SCHREIBZEUG_ARCHIVE_URL");
    expect(tokenOnly.ok ? "" : tokenOnly.error).not.toContain("belegt_secret-value");
    const withPath = readConfig({
      SCHREIBZEUG_ARCHIVE_URL: "https://archive.example.org/api",
      SCHREIBZEUG_ARCHIVE_TOKEN: "t",
    });
    expect(withPath.ok ? "" : withPath.error).toContain("SCHREIBZEUG_ARCHIVE_URL");
    for (const token of ["belegt_two words", "belegt_line\nbreak"]) {
      const config = readConfig({
        SCHREIBZEUG_ARCHIVE_URL: "https://archive.example.org",
        SCHREIBZEUG_ARCHIVE_TOKEN: token,
      });
      expect(config.ok ? "" : config.error).toContain("SCHREIBZEUG_ARCHIVE_TOKEN");
      expect(config.ok ? "" : config.error).not.toContain("belegt_");
    }
  });

  it("reports what is wrong", () => {
    const config = readConfig({ PORT: "kein Port" });
    expect(config.ok).toBe(false);
    expect(config.ok ? "" : config.error).toContain("PORT");
  });
});

describe("archive helpers", () => {
  it("knows a PDF by its first bytes", () => {
    const encode = (text: string) => new TextEncoder().encode(text);
    expect(isPdf(encode("%PDF-2.0\n…"))).toBe(true);
    for (const other of ["PK\u0003\u0004", "%PDF", " %PDF-1.7", ""]) expect(isPdf(encode(other))).toBe(false);
    expect(checkPdf(encode("<html>"))).toMatchObject({ ok: false, error: { kind: "invalid" } });
  });

  it("links to the archive's page of a document, its id encoded", () => {
    expect(documentPage("https://archive.example.org", "0c6f-11")).toBe(
      "https://archive.example.org/dokumente/0c6f-11",
    );
    expect(documentPage("https://archive.example.org", "../a?b")).toBe(
      "https://archive.example.org/dokumente/..%2Fa%3Fb",
    );
  });

  it("names the PDF after the file", () => {
    expect(pdfNameOf("Angebot 2026.docx")).toBe("Angebot 2026.pdf");
    expect(pdfNameOf("Vertrag.pdf")).toBe("Vertrag.pdf");
    expect(pdfNameOf("Notiz")).toBe("Notiz.pdf");
  });

  it("is not set up without the settings", () => {
    expect(requireArchive(undefined)).toMatchObject({ ok: false, error: { kind: "not_found" } });
  });

  it("tells the web app only whether there is an archive and its name", () => {
    const archive = { url: "https://archive.example.org", token: "belegt_secret", name: "Belegablage" };
    expect(withArchive({ mode: "server" }, archive)).toEqual({
      mode: "server",
      archive: { name: "Belegablage" },
    });
    expect(withArchive({ mode: "server" }, { ...archive, name: undefined })).toEqual({
      mode: "server",
      archive: {},
    });
    expect(withArchive({ mode: "server" }, undefined)).toEqual({ mode: "server" });
    expect(JSON.stringify(withArchive({ mode: "server" }, archive))).not.toMatch(/secret|example/);
  });
});
