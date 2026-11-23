import type { CursorLabel, CursorLabelListener } from "@schreibzeug/editor-core";
import { useEffect, useState } from "react";
import { m } from "../paraglide/messages";

/** The names over the others' cursors while the editor is open (editor-core cursor-labels.ts). */
export const useCursorLabels = (
  editor: { onCursorLabels: (listener: CursorLabelListener) => () => void } | null,
): readonly CursorLabel[] => {
  const [labels, setLabels] = useState<readonly CursorLabel[]>([]);
  useEffect(() => {
    if (!editor) return;
    const stop = editor.onCursorLabels(setLabels);
    return () => {
      stop();
      setLabels([]);
    };
  }, [editor]);
  return labels;
};

/**
 * A tag in the person's colour on top of their cursor, with their name, as web-apps shows it
 * (documenteditor/main controller/DocumentHolderExt.js onShowForeignCursorLabel). The engine's
 * frame fills the document area, so its coordinates are the area's.
 */
export const CursorLabels = ({ labels }: { labels: readonly CursorLabel[] }) => (
  <div data-testid="cursor-labels" className="pointer-events-none absolute inset-0 overflow-hidden">
    {labels.map((label) => (
      <span
        key={label.id}
        className="absolute -translate-y-full whitespace-nowrap rounded-t rounded-br px-1.5 text-xs leading-5 font-medium text-white shadow-sm"
        style={{ left: label.x, top: label.y, backgroundColor: label.color }}
      >
        {label.name || m.cursor_labels_guest()}
      </span>
    ))}
  </div>
);
