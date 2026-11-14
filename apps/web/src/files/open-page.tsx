import type { FileNode } from "@schreibzeug/files-api";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Brand } from "../account/brand";
import { messageOf } from "../api/client";
import { useFiles } from "../api/context";
import { refreshFiles } from "../api/files";
import { isEditable } from "../lib/format";
import { m } from "../paraglide/messages";

/** The link and the name in `/open?url=…&name=…`, as written, not as JSON the router may read them as. */
export const openParamsOf = (search: string): { url: string | undefined; name: string | undefined } => {
  const params = new URLSearchParams(search);
  return { url: params.get("url") || undefined, name: params.get("name") || undefined };
};

/**
 * What another app opens to hand over a file (`/open?url=<link>&name=<name>`): the server fetches a
 * copy into the user's files (POST /files/import), then the editor opens it. Signing in comes first
 * and returns here (router.tsx). Replacing the address keeps "back" from fetching it again.
 */
export const OpenPage = ({ url, name }: { url: string | undefined; name: string | undefined }) => {
  const { commands } = useFiles();
  const navigate = useNavigate();
  const open = (node: FileNode) =>
    isEditable(node)
      ? navigate({ to: "/edit/$fileId", params: { fileId: node.id }, replace: true })
      : navigate({ to: "/", replace: true });
  const fetchCopy = useMutation({
    mutationFn: (link: string) => commands.importFile(link, name),
    onSuccess: async (node, _vars, _result, { client }) => {
      await refreshFiles(client);
      await open(node);
    },
  });
  // Once per page: React's development double run would fetch a second copy.
  const started = useRef(false);
  useEffect(() => {
    if (!url || started.current) return;
    started.current = true;
    fetchCopy.mutate(url);
  }, [url, fetchCopy]);

  const failure = !url ? m.open_page_no_link() : fetchCopy.isError ? messageOf(fetchCopy.error) : null;
  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Brand />
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-xl font-semibold">{m.open_page_title()}</h1>
          {failure === null ? (
            <p className="m-0 text-sm text-[var(--muted-foreground)]" role="status">
              {m.open_page_loading()}
            </p>
          ) : (
            <div role="alert" className="flex flex-col gap-1 text-sm">
              <p className="m-0 font-medium">{m.open_page_failed()}</p>
              <p className="m-0 text-red-600 dark:text-red-400">{failure}</p>
            </div>
          )}
        </div>
        {failure !== null && <Link to="/">{m.open_page_to_files()}</Link>}
      </div>
    </main>
  );
};
