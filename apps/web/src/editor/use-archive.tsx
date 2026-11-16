import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { useFiles } from "../api/context";
import { fileKeys } from "../api/files";
import type { MenuItem } from "../ui/menu";
import { archiveDocument, archiveTexts } from "./archive";
import { ArchiveDialog } from "./archive-dialog";

export type ArchiveHandle = {
  /** "Im Archiv ablegen …" in the "Datei" menu; null where there is no archive or no right to it. */
  item: MenuItem | null;
  dialog: ReactNode;
};

/**
 * Saving the open document to the archive the server is set up with (`archive` in /api/info).
 * Offered to those who may edit, as the version sent is then kept, and only in editors that can
 * make a PDF/A.
 */
export const useArchive = ({
  fileId,
  name,
  readOnly,
  editor,
  unsaved,
  save,
}: {
  fileId: string | undefined;
  name: string;
  readOnly: boolean;
  editor: { exportPdf: ((pdfa?: boolean) => Promise<Uint8Array>) | null } | null;
  /** Whether there are changes not stored yet (editor-core hasUnsavedChanges). */
  unsaved: boolean;
  save: () => Promise<boolean>;
}): ArchiveHandle => {
  const { info, queries, commands } = useFiles();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const archive = info.mode === "server" ? info.archive : undefined;
  const exportPdf = editor?.exportPdf;
  if (!archive || !fileId || readOnly || !exportPdf) return { item: null, dialog: null };

  const onArchive: Parameters<typeof ArchiveDialog>[0]["onArchive"] = async (choice, onStep) => {
    const archived = await archiveDocument(
      {
        unsaved: () => unsaved,
        save,
        newestVersion: async () => {
          const node = await queryClient.fetchQuery({ ...queries.node(fileId), staleTime: 0 });
          return node.version ?? 1;
        },
        exportPdfA: () => exportPdf(true),
        send: (input) => commands.archive(fileId, input),
        onStep,
      },
      choice,
    );
    // The version is kept now (versions dialog).
    await queryClient.invalidateQueries({ queryKey: fileKeys.versions(fileId) });
    return archived.documents;
  };

  return {
    item: { label: archiveTexts(archive.name).menu, onSelect: () => setOpen(true) },
    dialog: (
      <ArchiveDialog
        open={open}
        onClose={() => setOpen(false)}
        name={name}
        archiveName={archive.name}
        onArchive={onArchive}
      />
    ),
  };
};
