import { numberedName } from "@schreibzeug/files-api";
import type { BlobStore } from "../blobs";
import type { Database } from "../db/database";
import type { Result } from "../result";
import type { Accessible, UserId } from "./access";
import { mimeOf } from "./mime";
import * as repository from "./repository";

export type StoreDeps = { db: Database; blobs: BlobStore };

/** How many numbered names (" (2)", " (3)" …) a new file tries before it gives up. */
const MAX_NAME_ATTEMPTS = 50;

/**
 * A new file from bytes, as an upload makes it: the type by its name, the bytes in the blob store,
 * the first version. With `renumber`, a taken name becomes "Name (2).ext", "Name (3).ext" and so on
 * instead of failing.
 */
export const createStoredFile = async (
  { db, blobs }: StoreDeps,
  user: UserId,
  input: { parentId: string | null; name: string; bytes: Uint8Array },
  { renumber = false }: { renumber?: boolean } = {},
): Promise<Result<Accessible>> => {
  // Checked before the bytes go into the blob store.
  const parent = repository.findTargetFolder(db, user, input.parentId);
  if (!parent.ok) return parent;
  const content = { size: input.bytes.byteLength, sha256: await blobs.put(input.bytes) };
  const attempts = renumber ? MAX_NAME_ATTEMPTS : 1;
  for (let attempt = 1; ; attempt += 1) {
    const name = numberedName(input.name, attempt);
    const created = repository.createFile(db, user, {
      parentId: input.parentId,
      name,
      mime: mimeOf(name),
      ...content,
    });
    if (created.ok || created.error.kind !== "name_taken" || attempt >= attempts) return created;
  }
};
