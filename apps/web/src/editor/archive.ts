import type { Archived } from "@schreibzeug/files-api";
import { isApiFailure, messageOf } from "../api/client";
import { m } from "../paraglide/messages";

/** What goes to the archive: the PDF/A of the document, its own file, or both. */
export type ArchiveChoice = { pdf: boolean; original: boolean };

/** The words for the archive, with the name the admin gave it (SCHREIBZEUG_ARCHIVE_NAME) where there is one. */
export const archiveTexts = (name: string | undefined) =>
  name
    ? {
        menu: m.archive_menu_named({ name }),
        action: m.archive_save_to_named({ name }),
        open: m.archive_open_in_named({ name }),
        intro: m.archive_intro_named({ name }),
      }
    : {
        menu: m.archive_menu(),
        action: m.archive_save_to(),
        open: m.archive_open_in(),
        intro: m.archive_intro(),
      };

/** ".docx" of "Angebot.docx"; empty for a name without one. */
export const extensionOf = (name: string): string => /\.[^.]+$/.exec(name)?.[0] ?? "";

export type ArchiveSteps = {
  /** Whether there are changes not stored yet. */
  unsaved: () => boolean;
  /** Stores the document; resolves with whether it was stored. */
  save: () => Promise<boolean>;
  /** The number of the newest version, asked from the server. */
  newestVersion: () => Promise<number>;
  /** A PDF/A of what the editor shows. */
  exportPdfA: () => Promise<Uint8Array>;
  send: (input: { pdf: Uint8Array | null; original: boolean; version: number }) => Promise<Archived>;
  /** Says what happens now, for the dialog's progress line. */
  onStep: (step: "saving" | "rendering" | "sending") => void;
};

/**
 * Saves the document first when it has changes, so the archive gets what was stored, then makes the
 * PDF/A of it and sends it with the newest version's number: the server refuses it when someone
 * saved in between, and keeps that version.
 */
export const archiveDocument = async (steps: ArchiveSteps, choice: ArchiveChoice): Promise<Archived> => {
  if (steps.unsaved()) {
    steps.onStep("saving");
    if (!(await steps.save())) throw new Error(m.archive_not_saved());
  }
  const version = await steps.newestVersion();
  if (choice.pdf) steps.onStep("rendering");
  const pdf = choice.pdf ? await steps.exportPdfA() : null;
  steps.onStep("sending");
  return steps.send({ pdf, original: choice.original, version });
};

/**
 * What to tell the person about a failure: the server's message, "not reachable" for a request that
 * got no answer, or what went wrong here (saving, making the PDF).
 */
export const archiveFailureText = (error: unknown): string =>
  isApiFailure(error) || error instanceof TypeError || !(error instanceof Error)
    ? messageOf(error)
    : error.message;
