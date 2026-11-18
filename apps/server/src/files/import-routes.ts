import { importFileSchema } from "@schreibzeug/files-api";
import { Hono } from "hono";
import type { AuthEnv } from "../session/context";
import { checkLink, fetchLinked, importName } from "./import";
import * as repository from "./repository";
import { respond, validate } from "./routes";
import { toFileNode } from "./serialize";
import { createStoredFile, type StoreDeps } from "./store";

export type ImportDeps = StoreDeps & {
  maxUploadBytes: number;
  /** `SCHREIBZEUG_IMPORT_ORIGINS`: the origins whose links may be fetched; empty: none. */
  importOrigins: readonly string[];
  /** Absent: IMPORT_TIMEOUT_MS. */
  importTimeoutMs?: number;
};

/**
 * Another app hands over a file by a link (`/open?url=…` in the web app): the server fetches it and
 * stores a copy as a new file, as an upload would. The original stays where it is.
 */
export const importRoutes = ({ db, blobs, maxUploadBytes, importOrigins, importTimeoutMs }: ImportDeps) =>
  new Hono<AuthEnv>().post("/files/import", validate("json", importFileSchema), async (c) => {
    const { url, name, parentId = null } = c.req.valid("json");
    const user = c.var.user.id;
    // Nothing is fetched for a link the server may not fetch or a file it could not store.
    const link = checkLink(url, importOrigins);
    if (!link.ok) return respond(c, link, () => null);
    const parent = repository.findTargetFolder(db, user, parentId);
    if (!parent.ok) return respond(c, parent, () => null);
    const fetched = await fetchLinked(link.value, {
      maxBytes: maxUploadBytes,
      ...(importTimeoutMs === undefined ? {} : { timeoutMs: importTimeoutMs }),
    });
    if (!fetched.ok) return respond(c, fetched, () => null);
    const created = await createStoredFile(
      { db, blobs },
      user,
      { parentId, name: importName(name, fetched.value), bytes: fetched.value.bytes },
      { renumber: true },
    );
    return respond(c, created, toFileNode, 201);
  });
