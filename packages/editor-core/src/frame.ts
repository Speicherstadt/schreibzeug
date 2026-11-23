import type { EngineWindow } from "./engine-types";

/** The editors of the engine: text documents, spreadsheets, presentations and PDFs. */
export type EditorKind = "word" | "cell" | "slide" | "pdf";

export type FrameOptions = {
  kind: EditorKind;
  /** Where engine/dist is served. */
  enginePath?: string;
  /** How long to wait for sdkjs to load, in milliseconds. */
  timeoutMs?: number;
};

export type EngineFrame = {
  window: EngineWindow;
  element: HTMLIFrameElement;
  remove: () => void;
};

/**
 * The host page of each editor, four folders below the engine root, because sdkjs resolves its
 * files as "../../../../sdkjs/…" relative to the page (engine/frame/editor/word/main/index.html).
 */
export const framePath = (kind: EditorKind, enginePath = "/engine"): string =>
  `${enginePath.replace(/\/$/, "")}/frame/editor/${kind}/main/index.html`;

/**
 * The constructor each editor's sdk-all defines (word/api.js, cell/api.js, slide/api.js). The PDF
 * editor is part of the text-document bundle (pdf/api.js PDFEditorApi, built into word/sdk-all).
 */
const API_CONSTRUCTOR: Record<EditorKind, string> = {
  word: "asc_docs_api",
  cell: "spreadsheet_api",
  slide: "asc_docs_api",
  pdf: "PDFEditorApi",
};

const isEngineLoaded = (win: Window | null, kind: EditorKind): win is EngineWindow => {
  const candidate = win as (Partial<EngineWindow> & { Asc?: Record<string, unknown> }) | null;
  return Boolean(candidate?.Asc?.[API_CONSTRUCTOR[kind]] && candidate.AscCommon);
};

type FocusableWindow = Pick<Window, "addEventListener"> & {
  document: Pick<Document, "hasFocus" | "activeElement" | "body">;
  AscCommon?: Pick<EngineWindow["AscCommon"], "g_inputContext">;
};

/**
 * Whether the engine takes the keys through its iOS input: on Safari for iPhone and iPad the text
 * editor puts a transparent contenteditable div over the whole canvas instead of the small textarea,
 * because iOS keeps the keyboard only while taps land on a text input (common/text_input2.js
 * CTextInput2, `isSafariMobile` and the Word editor).
 */
const isTouchOverlay = (input: Pick<HTMLElement, "tagName"> | null | undefined): boolean =>
  input?.tagName === "DIV";

/** How far a finger may move and still tap rather than scroll, in CSS pixels. */
const TAP_SLOP = 10;

type TouchPoint = { clientX: number; clientY: number };
const firstTouch = (event: Pick<TouchEvent, "changedTouches">): TouchPoint | undefined =>
  event.changedTouches[0];

/**
 * On iOS, opens the keyboard after a tap, as the engine's mobile mode does on touchend
 * (word/Drawing/mobileTouchManager.js mainOnTouchEnd -> showKeyboard). The engine's overlay lets no
 * touch through and is not editable until `g_inputContext.showKeyboard()` switches it on
 * (common/text_input2.js showKeyboard, setReadOnlyWrapper); in the desktop mode Schreibzeug runs
 * the engine in, nothing calls it. Focusing at pointerdown instead shows the keyboard for a moment
 * and iOS closes it again once the touch ends on the canvas. Focusing in touchend keeps the user
 * gesture iOS needs to show the keyboard. A finger that scrolled opens nothing.
 */
const openKeyboardOnTap = (win: FocusableWindow, input: () => HTMLElement): void => {
  let start: TouchPoint | undefined;
  win.addEventListener(
    "touchstart",
    (event: TouchEvent) => {
      start = event.touches.length === 1 && isTouchOverlay(input()) ? firstTouch(event) : undefined;
    },
    true,
  );
  win.addEventListener(
    "touchend",
    (event: TouchEvent) => {
      const end = firstTouch(event);
      const tapped =
        start && end && Math.hypot(end.clientX - start.clientX, end.clientY - start.clientY) <= TAP_SLOP;
      start = undefined;
      if (!tapped) return;
      win.AscCommon?.g_inputContext?.showKeyboard();
      input().focus();
    },
    true,
  );
};

/**
 * Gives the engine keyboard focus when someone presses the mouse in its frame. The engine cancels
 * mousedown on its canvas, so the browser leaves focus where it was, e.g. on a toolbar button of the
 * app, and typed keys never reach the document. Focusing the engine's hidden input fires the
 * document "focus" event sdkjs listens for (common/text_input2.js), which turns key events back on.
 * It is checked again when the main button is released: a click into the presentation's notes leaves the
 * focus on the page's body (slide/Drawing/HtmlPage.js, the notes pane's own mouse handling).
 * With the engine's iOS input the keyboard opens on a tap instead (openKeyboardOnTap).
 */
export const keepFocusOnClick = (win: FocusableWindow, input: () => HTMLElement): void => {
  // The engine makes its input while it starts, so which one it is is asked at every touch.
  openKeyboardOnTap(win, input);
  const refocus = () => {
    if (isTouchOverlay(input())) return;
    const { document } = win;
    // Nothing in the frame holds the keys; an element of the engine that does keeps them.
    if (!document.hasFocus() || document.activeElement === document.body) input().focus();
  };
  win.addEventListener("pointerdown", refocus, true);
  // Only for the main button: a right click opens the app's context menu, which keeps the focus.
  win.addEventListener("pointerup", (event: PointerEvent) => event.button === 0 && refocus(), true);
};

/**
 * Loads the engine in a same-origin iframe. The iframe keeps the engine's globals (Asc, AscCommon,
 * AscFonts, …) out of the app and gives every open document its own engine instance.
 */
export const mountEngineFrame = (container: HTMLElement, options: FrameOptions): Promise<EngineFrame> => {
  const element = container.ownerDocument.createElement("iframe");
  element.src = framePath(options.kind, options.enginePath);
  element.title = "Editor";
  element.setAttribute("data-testid", "engine-frame");
  // The engine's copy, cut and paste menu entries use the async clipboard (common/clipboard_base.js).
  element.allow = "clipboard-read; clipboard-write";
  element.style.cssText = "border:0;width:100%;height:100%;display:block";

  const remove = () => element.remove();

  return new Promise<EngineFrame>((resolve, reject) => {
    const timer = setTimeout(() => {
      remove();
      reject(new Error("The editor engine did not load in time."));
    }, options.timeoutMs ?? 30_000);

    element.addEventListener("load", () => {
      clearTimeout(timer);
      const win = element.contentWindow;
      if (isEngineLoaded(win, options.kind)) {
        resolve({ window: win, element, remove });
      } else {
        remove();
        reject(new Error("The editor engine is missing. Run `bun run engine:prepare`."));
      }
    });
    container.append(element);
  });
};
