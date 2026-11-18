import { type ArchivedDocument, nodeIdSchema } from "@schreibzeug/files-api";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { ArchiveConfig } from "../config";
import { fail, type Result } from "../result";
import type { AuthEnv } from "../session/context";
import { checkPdf, requireArchive, sendToArchive } from "./archive";
import * as repository from "./repository";
import { respond, validate } from "./routes";
import type { StoreDeps } from "./store";

export type ArchiveDeps = StoreDeps & {
  maxUploadBytes: number;
  /** SCHREIBZEUG_ARCHIVE_URL and _TOKEN; absent: the route answers 404 and sends nothing. */
  archive?: ArchiveConfig | undefined;
  /** Absent: files/archive.ts ARCHIVE_TIMEOUT_MS. */
  archiveTimeoutMs?: number;
  log?: (message: string, error: unknown) => void;
};

const archiveForm = z.object({
  /** The PDF/A the browser made of the version, if it is to go too. */
  pdf: z.instanceof(File, { message: "Das PDF fehlt." }).optional(),
  /** "true": the version's own file goes too. */
  original: z.enum(["true", "false"]).optional(),
  /** The version the PDF was made of: the newest when it was made. */
  version: z.coerce.number().int().positive(),
});

const NOTHING = "Wähle aus, was ins Archiv soll.";
const CHANGED = "Die Datei wurde inzwischen gespeichert. Lege sie noch einmal ab.";

/** "Angebot.docx" → "Angebot.pdf". */
export const pdfNameOf = (name: string): string => `${name.replace(/\.[^.]*$/, "")}.pdf`;

/**
 * Saves a version of a file to the archive (SCHREIBZEUG_ARCHIVE_URL) as unalterable documents:
 * the PDF/A the browser rendered of it and, if asked, the file itself. Needs edit, as the version
 * is then kept, so thinning never removes what the archive holds. Each document is sent on its own;
 * once one is in the archive the version is kept, even if the next fails.
 */
export const archiveRoutes = ({ db, blobs, maxUploadBytes, archive, archiveTimeoutMs, log }: ArchiveDeps) =>
  new Hono<AuthEnv>().post(
    "/files/:id/archive",
    bodyLimit({
      // Room for the multipart around the PDF.
      maxSize: maxUploadBytes + 64 * 1024,
      onError: (c) => c.json({ error: { kind: "too_large" as const, message: "Das PDF ist zu groß." } }, 413),
    }),
    validate("param", z.object({ id: nodeIdSchema })),
    validate("form", archiveForm),
    async (c) => {
      const configured = requireArchive(archive);
      if (!configured.ok) return respond(c, configured, () => null);
      const { id } = c.req.valid("param");
      const { pdf, original, version: wanted } = c.req.valid("form");
      const user = c.var.user.id;
      const access = repository.requireFile(db, user, id, "edit");
      if (!access.ok) return respond(c, access, () => null);
      if (!pdf && original !== "true") return respond(c, fail("invalid", NOTHING), () => null);
      if (access.value.node.version !== wanted) return respond(c, fail("conflict", CHANGED), () => null);
      const found = repository.findVersion(db, user, id, wanted);
      if (!found.ok) return respond(c, found, () => null);
      const { file, version } = found.value;
      const pdfBytes = pdf ? checkPdf(new Uint8Array(await pdf.arrayBuffer())) : null;
      if (pdfBytes && !pdfBytes.ok) return respond(c, pdfBytes, () => null);

      const files = [
        ...(pdfBytes
          ? [
              {
                kind: "pdf" as const,
                name: pdfNameOf(file.name),
                mime: "application/pdf",
                bytes: () => pdfBytes.value,
              },
            ]
          : []),
        ...(original === "true"
          ? [
              {
                kind: "original" as const,
                name: file.name,
                mime: file.mime ?? "application/octet-stream",
                bytes: () => blobs.get(version.sha256),
              },
            ]
          : []),
      ];
      const options = {
        ...(archiveTimeoutMs === undefined ? {} : { timeoutMs: archiveTimeoutMs }),
        ...(log ? { log: (message: string) => log("[archive]", message) } : {}),
      };
      const documents: ArchivedDocument[] = [];
      for (const item of files) {
        const sent = await sendToArchive(
          configured.value,
          { name: item.name, mime: item.mime, bytes: await item.bytes() },
          options,
        );
        if (!sent.ok) return respond(c, partly(sent, documents), () => null);
        documents.push({ kind: item.kind, name: item.name, ...sent.value });
        // What the archive holds stays among the versions (thinning.ts).
        if (documents.length === 1 && !version.kept) repository.keepVersion(db, user, id, wanted, true);
      }
      return c.json({ version: wanted, documents }, 201);
    },
  );

/** A failure after a document already went: the person must know it is in the archive. */
const partly = <T>(failure: Result<T>, sent: readonly ArchivedDocument[]): Result<T> =>
  failure.ok || sent.length === 0
    ? failure
    : fail(failure.error.kind, `Das PDF liegt im Archiv, das Original nicht: ${failure.error.message}`);
