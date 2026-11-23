/**
 * The names over the others' cursors in a shared text document.
 *
 * The engine draws another person's cursor as a thin line in their colour and asks its UI to put
 * their name over it: asc_onShowForeignCursorLabel with the person's connection id, the top of the
 * cursor relative to the engine's view (#id_main_view) and their colour; asc_onHideForeignCursorLabel
 * takes it away (common/CollaborativeEditingBase.js Show_ForeignCursorLabel,
 * Update_ForeignCursorLabelPosition, Remove_ForeignCursorXY; word/api.js
 * sync_ShowForeignCursorLabel). web-apps draws a small tag in that colour with the name
 * (documenteditor/main controller/DocumentHolderExt.js onShowForeignCursorLabel); here the labels
 * become data and the app draws them. The presentation engine keeps no place for a label
 * (its Update_ForeignCursorPosition never calls Add_ForeignCursorXY), so it has none.
 */
import { createListeners } from "./view";

/** The engine's view element, whose corner the label positions are measured from (word/Drawing/HtmlPage.js). */
export const ENGINE_VIEW_ID = "id_main_view";

/** A name to show over another person's cursor, at the top of that cursor in frame coordinates. */
export type CursorLabel = {
  /** The person's connection, as the engine names it. */
  id: string;
  /** Their name as the relay announced it; empty when the engine does not know them. */
  name: string;
  /** Their cursor's colour as #rrggbb. */
  color: string;
  x: number;
  y: number;
};

export type CursorLabelListener = (labels: readonly CursorLabel[]) => void;

/** common/editorscommon.js CColor, as the label events carry it. */
type EngineLabelColor = { get_r(): number; get_g(): number; get_b(): number };

export type CursorLabelArgs = {
  asc_onShowForeignCursorLabel: [id: string, x: number, y: number, color: EngineLabelColor];
  asc_onHideForeignCursorLabel: [id: string];
};

type CursorLabelApi = {
  asc_registerCallback(
    name: "asc_onShowForeignCursorLabel",
    callback: (...args: CursorLabelArgs["asc_onShowForeignCursorLabel"]) => void,
  ): void;
  asc_registerCallback(
    name: "asc_onHideForeignCursorLabel",
    callback: (...args: CursorLabelArgs["asc_onHideForeignCursorLabel"]) => void,
  ): void;
  /** common/docscoapi.js getParticipantName: the name from the relay's participant list. */
  CoAuthoringApi: { getParticipantName(id: string): string };
};

const hex = (value: number) => value.toString(16).padStart(2, "0");

export const colorOf = (color: EngineLabelColor): string =>
  `#${hex(color.get_r())}${hex(color.get_g())}${hex(color.get_b())}`;

/** The labels with this one shown, in place of an older one for the same person. */
export const showLabel = (labels: readonly CursorLabel[], label: CursorLabel): CursorLabel[] => [
  ...labels.filter((shown) => shown.id !== label.id),
  label,
];

export const hideLabel = (labels: readonly CursorLabel[], id: string): CursorLabel[] =>
  labels.filter((shown) => shown.id !== id);

/**
 * The labels as they come and go. `view` is the engine's view element, whose corner the engine
 * measures from.
 */
export const cursorLabelSource = (
  api: CursorLabelApi,
  view: () => { getBoundingClientRect(): { left: number; top: number } } | null,
) => {
  const listeners = createListeners<readonly CursorLabel[]>();
  let labels: readonly CursorLabel[] = [];
  const update = (next: readonly CursorLabel[]) => {
    labels = next;
    listeners.emit(labels);
  };
  api.asc_registerCallback("asc_onShowForeignCursorLabel", (id, x, y, color) => {
    const origin = view()?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const name = api.CoAuthoringApi.getParticipantName(id);
    update(showLabel(labels, { id, name, color: colorOf(color), x: origin.left + x, y: origin.top + y }));
  });
  api.asc_registerCallback("asc_onHideForeignCursorLabel", (id) => update(hideLabel(labels, id)));
  return (listener: CursorLabelListener) => {
    listener(labels);
    return listeners.add(listener);
  };
};

/** The longest wait setTimeout takes; anything longer runs at once. */
const LONGEST_TIMEOUT = 2 ** 31 - 1;

/** common/CollaborativeEditingBase.js, as far as the labels go. */
export type ForeignCursors = {
  /** Places another person's cursor (word/Editor/CollaborativeEditing.js). */
  Update_ForeignCursorPosition(id: string, ...position: unknown[]): void;
  /** Sends asc_onShowForeignCursorLabel for that cursor, where it is now, and starts its hide timer. */
  Show_ForeignCursorLabel(id: string): void;
};

/**
 * Shows each other person's name whenever their cursor is placed, and keeps it up while they are
 * there. The engine shows a label only after that person's changes came in (Refresh_ForeignCursors)
 * or while the mouse is over the cursor (Check_ForeignCursorsLabels); a cursor that only moved gets
 * none (word/Editor/Document.js Update_ForeignCursor). It takes the label down 1.5 s later
 * (FOREIGN_CURSOR_LABEL_HIDETIME, read from AscCommon each time). On a phone nothing hovers, and the
 * name is what tells another person's cursor from one's own; it goes when they leave
 * (Remove_ForeignCursorXY).
 */
export const keepCursorLabels = (asc: {
  FOREIGN_CURSOR_LABEL_HIDETIME?: number;
  CollaborativeEditing?: ForeignCursors;
}): void => {
  asc.FOREIGN_CURSOR_LABEL_HIDETIME = LONGEST_TIMEOUT;
  const cursors = asc.CollaborativeEditing;
  if (!cursors) return;
  const place = cursors.Update_ForeignCursorPosition;
  cursors.Update_ForeignCursorPosition = function (id, ...position) {
    place.call(this, id, ...position);
    this.Show_ForeignCursorLabel(id);
  };
};
