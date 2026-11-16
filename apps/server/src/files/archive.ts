import { z } from "zod";
import type { ArchiveConfig } from "../config";
import { fail, ok, type Result } from "../result";
import { readAtMost } from "./import";

/** How long the archive may take to take one document, answer included. */
export const ARCHIVE_TIMEOUT_MS = 60_000;

/** An archive's answer is a document's details, never more than this. */
const MAX_ANSWER_BYTES = 1024 * 1024;

const NOT_SET_UP = "Ablegen im Archiv ist auf diesem Server nicht eingerichtet.";
const UNREACHABLE = "Das Archiv ist nicht erreichbar oder antwortet nicht wie erwartet.";
const REFUSED =
  "Das Archiv hat den Zugang dieses Servers abgelehnt. Die Verwaltung muss den Schlüssel für das Archiv prüfen.";
const TOO_LARGE_THERE = "Die Datei ist dem Archiv zu groß.";
const NOT_A_PDF = "Das ist kein PDF.";

/** The archive's settings, or why saving to it is not offered. */
export const requireArchive = (archive: ArchiveConfig | undefined): Result<ArchiveConfig> =>
  archive ? ok(archive) : fail("not_found", NOT_SET_UP);

/** A PDF as far as can be told cheaply: it starts as one (ISO 32000-1 7.5.2, `%PDF-`). */
export const isPdf = (bytes: Uint8Array): boolean =>
  bytes.byteLength > 5 && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";

export const checkPdf = (bytes: Uint8Array): Result<Uint8Array> =>
  isPdf(bytes) ? ok(bytes) : fail("invalid", NOT_A_PDF);

/** The archive's page of a document: `<archive>/dokumente/<id>`. */
export const documentPage = (archiveUrl: string, id: string): string =>
  `${archiveUrl}/dokumente/${encodeURIComponent(id)}`;

/** Of the archive's answer only the new document's id counts (`201` with the document as JSON). */
const answerSchema = z.object({ id: z.string().min(1).max(200) });

export type ArchiveFile = { name: string; mime: string; bytes: Uint8Array };

/** What the archive answered, for the server's log: never the token, never the body. */
export type ArchiveLog = (message: string) => void;

const answerOf = async (response: Response): Promise<Result<{ id: string }>> => {
  const bytes = await readAtMost(response.body, MAX_ANSWER_BYTES);
  let json: unknown = null;
  try {
    json = bytes && JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    json = null;
  }
  const parsed = answerSchema.safeParse(json);
  return parsed.success ? ok({ id: parsed.data.id }) : fail("upstream_failed", UNREACHABLE);
};

/**
 * Sends one file to the archive as a new document: `POST <archive>/api/dokumente`, multipart with
 * the file in `datei`, the token as `Authorization: Bearer`. Redirects are not followed, so the
 * token only ever reaches the configured origin; a 3xx counts as a failure. 401 and 403 mean the
 * archive refused the token, which only the admin can fix.
 */
export const sendToArchive = async (
  archive: ArchiveConfig,
  file: ArchiveFile,
  { timeoutMs = ARCHIVE_TIMEOUT_MS, log = () => {} }: { timeoutMs?: number; log?: ArchiveLog } = {},
): Promise<Result<{ id: string; url: string }>> => {
  const body = new FormData();
  body.append("datei", new File([file.bytes as Uint8Array<ArrayBuffer>], file.name, { type: file.mime }));
  try {
    const response = await fetch(new URL("/api/dokumente", archive.url), {
      method: "POST",
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { authorization: `Bearer ${archive.token}`, accept: "application/json" },
    });
    if (!response.ok) {
      await response.body?.cancel();
      log(`The archive answered ${response.status} to a new document.`);
      if (response.status === 401 || response.status === 403) return fail("upstream_refused", REFUSED);
      if (response.status === 413) return fail("too_large", TOO_LARGE_THERE);
      return fail("upstream_failed", UNREACHABLE);
    }
    const answer = await answerOf(response);
    if (!answer.ok) {
      log(`The archive answered ${response.status} without a document id.`);
      return answer;
    }
    return ok({ id: answer.value.id, url: documentPage(archive.url, answer.value.id) });
  } catch (error) {
    // Refused connection, unknown host, TLS, the timeout. The error names the address, not the token.
    log(`The archive could not be reached: ${error instanceof Error ? error.name : "error"}.`);
    return fail("upstream_failed", UNREACHABLE);
  }
};
