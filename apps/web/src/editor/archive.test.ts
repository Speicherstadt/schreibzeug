import type { Archived } from "@schreibzeug/files-api";
import { describe, expect, it } from "vitest";
import { type ArchiveSteps, archiveDocument, archiveFailureText, archiveTexts, extensionOf } from "./archive";
import { fileMenu } from "./file-menu";

const ARCHIVED: Archived = {
  version: 4,
  documents: [
    { kind: "pdf", name: "Angebot.pdf", id: "a1", url: "https://archive.example.org/dokumente/a1" },
  ],
};
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

/** The steps with a record of what was called, in order. */
const stepsFor = (overrides: Partial<ArchiveSteps> = {}) => {
  const calls: string[] = [];
  const sent: Parameters<ArchiveSteps["send"]>[0][] = [];
  const steps: ArchiveSteps = {
    unsaved: () => false,
    save: async () => {
      calls.push("save");
      return true;
    },
    newestVersion: async () => {
      calls.push("version");
      return 4;
    },
    exportPdfA: async () => {
      calls.push("pdf");
      return PDF;
    },
    send: async (input) => {
      calls.push("send");
      sent.push(input);
      return ARCHIVED;
    },
    onStep: (step) => calls.push(`step:${step}`),
    ...overrides,
  };
  return { steps, calls, sent };
};

describe("archiveDocument", () => {
  it("sends the PDF/A with the newest version's number, without saving an unchanged document", async () => {
    const { steps, calls, sent } = stepsFor();
    expect(await archiveDocument(steps, { pdf: true, original: false })).toBe(ARCHIVED);
    expect(calls).toEqual(["version", "step:rendering", "pdf", "step:sending", "send"]);
    expect(sent).toEqual([{ pdf: PDF, original: false, version: 4 }]);
  });

  it("saves changes first, and stops when that fails", async () => {
    const saved = stepsFor({ unsaved: () => true });
    await archiveDocument(saved.steps, { pdf: true, original: true });
    expect(saved.calls.slice(0, 3)).toEqual(["step:saving", "save", "version"]);
    expect(saved.sent[0]).toMatchObject({ original: true });

    const failed = stepsFor({ unsaved: () => true, save: async () => false });
    await expect(archiveDocument(failed.steps, { pdf: true, original: false })).rejects.toThrow(
      "Das Dokument ließ sich nicht speichern.",
    );
    expect(failed.sent).toEqual([]);
  });

  it("makes no PDF when only the original goes", async () => {
    const { steps, calls, sent } = stepsFor();
    await archiveDocument(steps, { pdf: false, original: true });
    expect(calls).not.toContain("pdf");
    expect(sent).toEqual([{ pdf: null, original: true, version: 4 }]);
  });
});

describe("archive texts", () => {
  it("say 'Archiv' without a name and the name the admin gave otherwise", () => {
    expect(archiveTexts(undefined)).toMatchObject({ menu: "Im Archiv ablegen …", open: "Im Archiv öffnen" });
    expect(archiveTexts("Belegablage")).toMatchObject({
      menu: "In Belegablage ablegen …",
      action: "In Belegablage ablegen",
      open: "In Belegablage öffnen",
    });
  });

  it("name the original by its extension", () => {
    expect(extensionOf("Angebot 2026.docx")).toBe(".docx");
    expect(extensionOf("Notiz")).toBe("");
  });

  it("tell the server's message, or what went wrong here", () => {
    const failure = Object.assign(new Error("x"), {
      status: 502,
      error: { kind: "upstream_refused" as const, message: "Das Archiv hat den Zugang abgelehnt." },
    });
    expect(archiveFailureText(failure)).toBe("Das Archiv hat den Zugang abgelehnt.");
    expect(archiveFailureText(new Error("Kein PDF möglich."))).toBe("Kein PDF möglich.");
    expect(archiveFailureText(new TypeError("Failed to fetch"))).not.toContain("fetch");
  });
});

describe("the file menu", () => {
  const actions = { onNew: () => {}, onCopy: () => {}, onClose: () => {} };
  const pdf = { downloadPdfA: () => {}, print: () => {} };
  const labels = (archive: Parameters<typeof fileMenu>[5]) =>
    fileMenu(actions, () => {}, pdf, true, [], archive)
      .groups.flat()
      .map((item) => item.label);

  it("offers saving to the archive only where there is one", () => {
    expect(labels(null)).not.toContain("Im Archiv ablegen …");
    expect(labels({ label: "Im Archiv ablegen …", onSelect: () => {} })).toContain("Im Archiv ablegen …");
  });
});
