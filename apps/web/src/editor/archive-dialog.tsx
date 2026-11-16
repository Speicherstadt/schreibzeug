import type { ArchivedDocument } from "@schreibzeug/files-api";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { m } from "../paraglide/messages";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { type ArchiveChoice, archiveFailureText, archiveTexts, extensionOf } from "./archive";

export type ArchiveStep = "saving" | "rendering" | "sending";

export type ArchiveDialogProps = {
  open: boolean;
  onClose: () => void;
  /** The file's name, for the extension of the original. */
  name: string;
  /** What the admin calls the archive; absent: "Archiv". */
  archiveName: string | undefined;
  /** Saves, makes the PDF/A and sends; resolves with what the archive holds now. */
  onArchive: (choice: ArchiveChoice, onStep: (step: ArchiveStep) => void) => Promise<ArchivedDocument[]>;
};

/** "Im Archiv ablegen": what goes, then the progress, then links to the documents in the archive. */
export const ArchiveDialog = (props: ArchiveDialogProps) => (
  <Dialog open={props.open} title={archiveTexts(props.archiveName).action} onClose={props.onClose}>
    {props.open && <ArchiveForm {...props} />}
  </Dialog>
);

const stepText = (step: ArchiveStep) =>
  ({
    saving: m.archive_dialog_step_saving(),
    rendering: m.archive_dialog_step_rendering(),
    sending: m.archive_dialog_step_sending(),
  })[step];

const ArchiveForm = ({ onClose, name, archiveName, onArchive }: Omit<ArchiveDialogProps, "open">) => {
  const texts = archiveTexts(archiveName);
  const [choice, setChoice] = useState<ArchiveChoice>({ pdf: true, original: false });
  const [step, setStep] = useState<ArchiveStep | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ArchivedDocument[] | null>(null);
  const nothing = !choice.pdf && !choice.original;

  const run = async () => {
    setFailure(null);
    setStep("saving");
    try {
      setDocuments(await onArchive(choice, setStep));
    } catch (error) {
      setFailure(archiveFailureText(error));
    } finally {
      setStep(null);
    }
  };

  if (documents) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="m-0 text-sm">
          {m.archive_dialog_done()}
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {documents.map((document) => (
            <li key={document.id}>
              <a
                href={document.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm underline underline-offset-2"
              >
                <ExternalLink size={14} aria-hidden />
                {`${texts.open}: ${document.name}`}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            {m.common_close()}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void run();
      }}
    >
      <p className="m-0 text-sm text-[var(--muted-foreground)]">{texts.intro}</p>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" disabled={step !== null}>
        <legend className="mb-1 p-0 text-sm font-medium">{m.archive_dialog_what()}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={choice.pdf}
            onChange={(event) => setChoice({ ...choice, pdf: event.target.checked })}
          />
          {m.archive_dialog_pdfa()}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={choice.original}
            onChange={(event) => setChoice({ ...choice, original: event.target.checked })}
          />
          {m.archive_dialog_original({ extension: extensionOf(name) || name })}
        </label>
      </fieldset>
      <p className="m-0 text-xs text-[var(--muted-foreground)]">{m.archive_dialog_kept_hint()}</p>
      {step && (
        <p role="status" className="m-0 text-sm">
          {stepText(step)}
        </p>
      )}
      {failure && (
        <p role="alert" className="m-0 text-sm text-red-600 dark:text-red-400">
          {failure}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={step !== null}>
          {m.common_cancel()}
        </Button>
        <Button variant="primary" type="submit" disabled={step !== null || nothing}>
          {step ? m.archive_dialog_running() : m.archive_dialog_confirm()}
        </Button>
      </div>
    </form>
  );
};
