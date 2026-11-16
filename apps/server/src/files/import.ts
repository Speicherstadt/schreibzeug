import { nodeNameSchema } from "@schreibzeug/files-api";
import { fail, ok, type Result } from "../result";
import { extensionOf, mimeOf, UNKNOWN_MIME } from "./mime";

/** How long fetching a linked file may take, answer and bytes together. */
export const IMPORT_TIMEOUT_MS = 60_000;

const NOT_SET_UP = "Öffnen aus einem Link ist auf diesem Server nicht eingerichtet.";
const NOT_ALLOWED = "Von dieser Adresse holt Schreibzeug keine Dateien.";
const EXPIRED = "Der Link ist abgelaufen oder ungültig.";
const TOO_LARGE = "Die Datei ist zu groß.";
const UNREACHABLE = "Die Datei ließ sich nicht holen: Der Server dahinter antwortet nicht wie erwartet.";

/**
 * The link as a URL when the server may fetch it: http(s), no user name or password, and its
 * origin exactly one of `SCHREIBZEUG_IMPORT_ORIGINS`. This is what keeps the route from fetching
 * addresses in the server's own network for whoever asks.
 */
export const checkLink = (link: string, origins: readonly string[]): Result<URL> => {
  if (origins.length === 0) return fail("not_found", NOT_SET_UP);
  const url = URL.parse(link);
  const allowed =
    url !== null &&
    (url.protocol === "http:" || url.protocol === "https:") &&
    !url.username &&
    !url.password &&
    origins.includes(url.origin);
  return allowed ? ok(url) : fail("forbidden", NOT_ALLOWED);
};

export type Fetched = { bytes: Uint8Array; contentType: string | null; disposition: string | null };

/** The body, or null as soon as it grows past `maxBytes`; a Content-Length alone is not trusted. */
export const readAtMost = async (
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array | null> => {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

/**
 * Fetches a checked link (checkLink). Redirects are not followed: the next address could be any
 * host, so a 3xx counts as a failure like any answer but 2xx. 404 and 410 mean the link has
 * expired or the file is gone.
 */
export const fetchLinked = async (
  url: URL,
  { maxBytes, timeoutMs = IMPORT_TIMEOUT_MS }: { maxBytes: number; timeoutMs?: number },
): Promise<Result<Fetched>> => {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "*/*" },
    });
    const refused = (kind: "link_expired" | "upstream_failed" | "too_large", message: string) =>
      response.body?.cancel().then(() => fail(kind, message)) ?? fail(kind, message);
    if (response.status === 404 || response.status === 410) return await refused("link_expired", EXPIRED);
    if (!response.ok) return await refused("upstream_failed", UNREACHABLE);
    if (Number(response.headers.get("content-length")) > maxBytes)
      return await refused("too_large", TOO_LARGE);
    const bytes = await readAtMost(response.body, maxBytes);
    if (!bytes) return fail("too_large", TOO_LARGE);
    return ok({
      bytes,
      contentType: response.headers.get("content-type"),
      disposition: response.headers.get("content-disposition"),
    });
  } catch {
    // Refused connection, unknown host, TLS, the timeout: the other server is not reachable as it should be.
    return fail("upstream_failed", UNREACHABLE);
  }
};

/** RFC 8187 allows UTF-8 and ISO-8859-1 in `filename*`. */
const decodeExtended = (charset: string, value: string): string | undefined => {
  if (/^iso-8859-1$/i.test(charset))
    return value.replace(/%([0-9a-f]{2})/gi, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
};

/** The file name a Content-Disposition header gives (RFC 6266): `filename*` before `filename`. */
export const dispositionName = (header: string | null): string | undefined => {
  if (!header) return undefined;
  const extended = /filename\*\s*=\s*([^']*)'[^']*'([^;\s]+)/i.exec(header);
  const decoded = extended && decodeExtended(extended[1] ?? "", extended[2] ?? "");
  if (decoded) return decoded;
  const plain = /filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]+))/i.exec(header);
  if (!plain) return undefined;
  return plain[1] !== undefined ? plain[1].replace(/\\(.)/g, "$1") : plain[2]?.trim();
};

/** The name without a folder some systems put before it. */
const lastSegment = (name: string | undefined) => name?.split(/[/\\]/).pop();

const validName = (name: string | undefined): string | undefined => {
  const parsed = name === undefined ? undefined : nodeNameSchema.safeParse(name);
  return parsed?.success ? parsed.data : undefined;
};

/** The name of a file fetched without one. */
export const FALLBACK_NAME = "Datei";

/**
 * The name to store a fetched file under: the one asked for when it is a valid name, else the one
 * the answer's Content-Disposition gives, else "Datei". Without an extension the type is known by,
 * it gets the one of the answer's Content-Type, so the file opens in its editor.
 */
export const importName = (
  requested: string | undefined,
  { contentType, disposition }: Pick<Fetched, "contentType" | "disposition">,
): string => {
  const name = validName(requested) ?? validName(lastSegment(dispositionName(disposition))) ?? FALLBACK_NAME;
  const extension = extensionOf(contentType);
  if (mimeOf(name) !== UNKNOWN_MIME || !extension) return name;
  return validName(`${name}${extension}`) ?? name;
};
