import { isIP } from "node:net";
import { z } from "zod";

const MEGABYTE = 1024 * 1024;

const flag = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((value) => value === "true" || value === "1");

/** An address that may be left empty, without its trailing slash. */
const optionalUrl = z
  .preprocess((value) => value || undefined, z.url().optional())
  .transform((value) => value?.replace(/\/+$/, ""));

/** A comma-separated list, without blanks. */
const listOf = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

/** An IPv4 or IPv6 address, or a CIDR range of them. */
const isAddressOrRange = (entry: string) => {
  const [address = "", prefix, ...rest] = entry.split("/");
  const family = isIP(address);
  if (!family || rest.length) return false;
  if (prefix === undefined) return true;
  return /^\d+$/.test(prefix) && Number(prefix) <= (family === 4 ? 32 : 128);
};

const addressList = z
  .string()
  .optional()
  .transform(listOf)
  .refine((entries) => entries.every(isAddressOrRange), {
    message: "SCHREIBZEUG_TRUSTED_PROXIES takes IP addresses or CIDR ranges, separated by commas.",
  });

/** An http(s) origin as the browser writes it: scheme, host and port, nothing after. */
const isOrigin = (entry: string) => {
  const url = URL.parse(entry);
  return url !== null && (url.protocol === "http:" || url.protocol === "https:") && url.origin === entry;
};

const originList = z
  .string()
  .optional()
  .transform((value) => listOf(value).map((entry) => entry.replace(/\/+$/, "")))
  .refine((entries) => entries.every(isOrigin), {
    message:
      "SCHREIBZEUG_IMPORT_ORIGINS takes origins such as https://archive.example.org (no path), separated by commas.",
  });

/** An empty variable counts as unset, as `KEY=` in a compose file or an env file leaves it. */
const unsetIfEmpty = (value: unknown) => (value === "" ? undefined : value);

const archiveUrl = z.preprocess(
  unsetIfEmpty,
  z
    .string()
    .transform((value) => value.replace(/\/+$/, ""))
    .refine(isOrigin, {
      message: "SCHREIBZEUG_ARCHIVE_URL takes an origin such as https://archive.example.org (no path).",
    })
    .optional(),
);

// The token goes into a header as it is; the message never repeats the value.
const archiveToken = z.preprocess(
  unsetIfEmpty,
  z
    .string()
    .regex(/^[\x21-\x7e]+$/, { message: "SCHREIBZEUG_ARCHIVE_TOKEN takes one word of printable characters." })
    .optional(),
);

const archiveName = z.preprocess(
  unsetIfEmpty,
  z.string().trim().min(1).max(60, "SCHREIBZEUG_ARCHIVE_NAME takes at most 60 characters.").optional(),
);

const configSchema = z.object({
  SCHREIBZEUG_DATA_DIR: z.string().min(1).default("data"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  SCHREIBZEUG_MAX_UPLOAD_MB: z.coerce.number().positive().default(512),
  SCHREIBZEUG_AUTH_SECRET: z
    .string()
    .min(32, "SCHREIBZEUG_AUTH_SECRET needs at least 32 characters.")
    .optional(),
  SCHREIBZEUG_OPEN_SIGNUP: flag,
  SCHREIBZEUG_TRUSTED_ORIGINS: z.string().optional(),
  SCHREIBZEUG_TRUSTED_PROXIES: addressList,
  SCHREIBZEUG_WEB_DIR: z.string().min(1).optional(),
  SCHREIBZEUG_URL: optionalUrl,
  SCHREIBZEUG_EMBED_ORIGIN: optionalUrl,
  OIDC_ISSUER: optionalUrl,
  OIDC_CLIENT_ID: z.string().min(1).optional(),
  OIDC_CLIENT_SECRET: z.string().min(1).optional(),
  OIDC_NAME: z.string().min(1).default("Kontext"),
  SCHREIBZEUG_VERSIONS: z.enum(["thin", "all"]).default("thin"),
  SCHREIBZEUG_IMPORT_ORIGINS: originList,
  SCHREIBZEUG_ARCHIVE_URL: archiveUrl,
  SCHREIBZEUG_ARCHIVE_TOKEN: archiveToken,
  SCHREIBZEUG_ARCHIVE_NAME: archiveName,
});

/** Signing in through another service (OpenID Connect), e.g. Kontext. */
export type OidcConfig = {
  /** The provider's issuer; discovery is at `<issuer>/.well-known/openid-configuration`. */
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** The name on the button: "Anmelden mit <name>". */
  name: string;
};

/** The archive documents are saved to (files/archive.ts). */
export type ArchiveConfig = {
  /** Its origin; documents go to `<url>/api/dokumente`. */
  url: string;
  /** Its API token, a secret: only ever sent to `url`, in the Authorization header. */
  token: string;
  /** What the interface calls it; absent: "Archiv". */
  name: string | undefined;
};

export type Config = {
  /** The blobs and the SQLite database (schreibzeug.db) live here. */
  dataDir: string;
  port: number;
  maxUploadBytes: number;
  /** Absent: main.ts keeps a generated one in the data folder. */
  authSecret: string | undefined;
  openSignup: boolean;
  trustedOrigins: string[];
  /** The proxies in front of the server (addresses or CIDR ranges); empty: clients connect directly. */
  trustedProxies: string[];
  /** The built web app (apps/web/dist) to serve beside the API; absent: the API only. */
  webDir: string | undefined;
  /** Where browsers reach this server; the base of the sign-in callback, the API tokens' audience and the links the MCP tools give. */
  publicUrl: string | undefined;
  /** The one site that may show Schreibzeug in a frame (Kontext), as an origin. */
  embedOrigin: string | undefined;
  /** Absent: email and password only. */
  oidc: OidcConfig | undefined;
  /** "thin": older versions are thinned out with age (files/thinning.ts); "all": every one stays. */
  versionPolicy: "thin" | "all";
  /** The origins whose links `POST /api/files/import` may fetch (files/import.ts); empty: none. */
  importOrigins: string[];
  /** Absent: saving to an archive is not offered. */
  archive: ArchiveConfig | undefined;
};

type ParsedConfig = z.infer<typeof configSchema>;

/** The OIDC settings, when all three that it needs are there. */
const oidcOf = (value: ParsedConfig): OidcConfig | undefined =>
  value.OIDC_ISSUER && value.OIDC_CLIENT_ID && value.OIDC_CLIENT_SECRET
    ? {
        issuer: value.OIDC_ISSUER,
        clientId: value.OIDC_CLIENT_ID,
        clientSecret: value.OIDC_CLIENT_SECRET,
        name: value.OIDC_NAME,
      }
    : undefined;

/** Reads the server's settings from the environment; every one has a default for development. */
export const readConfig = (env: Record<string, string | undefined>) => {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) return { ok: false as const, error: z.prettifyError(parsed.error) };
  const value = parsed.data;
  const oidc = oidcOf(value);
  // Without it Better Auth takes its base URL, and so the sign-in's redirect_uri, from the Host
  // header of each request (better-auth utils/url.mjs getBaseURL): anyone could name their own.
  if (oidc && !value.SCHREIBZEUG_URL) {
    return {
      ok: false as const,
      error:
        "Signing in through OIDC (OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET) needs SCHREIBZEUG_URL, the address people open.",
    };
  }
  // One without the other is a setup half done; say so instead of hiding the feature.
  if (Boolean(value.SCHREIBZEUG_ARCHIVE_URL) !== Boolean(value.SCHREIBZEUG_ARCHIVE_TOKEN)) {
    return {
      ok: false as const,
      error: "Saving to an archive needs both SCHREIBZEUG_ARCHIVE_URL and SCHREIBZEUG_ARCHIVE_TOKEN.",
    };
  }
  const config: Config = {
    dataDir: value.SCHREIBZEUG_DATA_DIR,
    port: value.PORT,
    maxUploadBytes: value.SCHREIBZEUG_MAX_UPLOAD_MB * MEGABYTE,
    authSecret: value.SCHREIBZEUG_AUTH_SECRET,
    openSignup: value.SCHREIBZEUG_OPEN_SIGNUP,
    trustedOrigins: listOf(value.SCHREIBZEUG_TRUSTED_ORIGINS),
    trustedProxies: value.SCHREIBZEUG_TRUSTED_PROXIES,
    webDir: value.SCHREIBZEUG_WEB_DIR,
    publicUrl: value.SCHREIBZEUG_URL,
    embedOrigin: value.SCHREIBZEUG_EMBED_ORIGIN && new URL(value.SCHREIBZEUG_EMBED_ORIGIN).origin,
    oidc,
    versionPolicy: value.SCHREIBZEUG_VERSIONS,
    importOrigins: value.SCHREIBZEUG_IMPORT_ORIGINS,
    archive:
      value.SCHREIBZEUG_ARCHIVE_URL && value.SCHREIBZEUG_ARCHIVE_TOKEN
        ? {
            url: value.SCHREIBZEUG_ARCHIVE_URL,
            token: value.SCHREIBZEUG_ARCHIVE_TOKEN,
            name: value.SCHREIBZEUG_ARCHIVE_NAME,
          }
        : undefined,
  };
  return { ok: true as const, value: config };
};
