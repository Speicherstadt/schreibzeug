/**
 * How often the text and presentation engines draw on a touch screen.
 *
 * The engine draws in a loop (common/Drawings/WorkEvents.js PaintMessageLoop, made with 40 ms in
 * word/Drawing/HtmlPage.js and slide/Drawing/HtmlPage.js). Without the `mobile` config it draws at
 * most every 40 ms (`isUseInterval`), 25 frames a second, which stutters while a finger scrolls;
 * web-apps' mobile editors pass `mobile: true` (documenteditor/mobile Main.jsx) and draw on every
 * animation frame. That config switches much more (input focus, rulers, scroll bars), so only the
 * loop is changed here. The engine also falls back to a 40 ms timer in browsers it does not know as
 * Chrome or Safari (`isUseRequestAnimationFrame`), Firefox among them; where the browser has
 * requestAnimationFrame, it is used there too.
 */

/** common/Drawings/WorkEvents.js PaintMessageLoop, as far as it is changed here. */
export type PaintLoop = {
  isUseInterval: boolean;
  isUseRequestAnimationFrame: boolean;
  requestAnimationFrame: ((callback: FrameRequestCallback) => number) | null;
  /** The running timer or frame request, null while the loop is not started. */
  id: number | null;
  /** What the loop runs each time (HtmlPage.js onTimerScroll), set by Start. */
  engine: (() => void) | null;
  Start(engine: () => void): void;
};

/**
 * Lets the loop draw on every animation frame. A loop not started yet picks this up when the
 * engine starts it; a loop already on the timer is moved over. Not through `Stop`, which calls a
 * `this.clearTimeout` the loop does not have (WorkEvents.js).
 */
export const paintEveryFrame = (loop: PaintLoop, clearTimer: (id: number) => void): void => {
  loop.isUseInterval = false;
  if (loop.isUseRequestAnimationFrame || !loop.requestAnimationFrame) return;
  const { id, engine } = loop;
  if (id !== null) clearTimer(id);
  loop.id = null;
  loop.isUseRequestAnimationFrame = true;
  if (id !== null && engine) loop.Start(engine);
};

/** common/Scrolls/mobileTouchManagerBase.js `CMobileDelegateEditor`, as far as scrolling goes. */
export type MobileScrollDelegate = {
  prototype: { ScrollTo(this: { HtmlPage: { NoneRepaintPages: boolean } }, scroll: unknown): void };
};

/**
 * Draws the pages also while the text glides on after the finger lets go. The delegate's ScrollTo
 * sets `NoneRepaintPages` for as long as that glide animates (mobileTouchManagerBase.js), and
 * word/Drawing/HtmlPage.js OnPaint then shows only pages it already has: every other page stays
 * white until the glide stops, and pages that left the screen were dropped
 * (StopRenderingPage). Pinching still holds the pages back (word/Drawing/mobileTouchManager.js).
 */
export const drawPagesWhileGliding = (delegate: MobileScrollDelegate): void => {
  const scrollTo = delegate.prototype.ScrollTo;
  delegate.prototype.ScrollTo = function (scroll) {
    scrollTo.call(this, scroll);
    this.HtmlPage.NoneRepaintPages = false;
  };
};

/**
 * The engine's mobile mode on a phone, as web-apps' mobile editors run it (`mobile: true`,
 * documenteditor/mobile Main.jsx; common/apiBase.js isMobileVersion): the keyboard opens after a
 * tap (word/Drawing/mobileTouchManager.js showKeyboard, needed for Safari on iOS), the paint loop
 * draws every frame, and touch targets, zoom and the spreadsheet's cell editing are made for a
 * finger. It hides rulers and scroll bars and the presentation's notes (switched on again in
 * slide.ts).
 */
export const mobileConfig = (options: { phone?: boolean | undefined }): { mobile?: true } =>
  options.phone ? { mobile: true } : {};

/** A finger is the main pointer: a phone or a tablet, not a laptop that also has a touch screen. */
export const isTouchScreen = (win: Pick<Window, "matchMedia">): boolean => {
  try {
    return win.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
};

/** What the engine scrolls with on a touch screen; the presentation editor has no pages to glide. */
export type TouchScrolling = { loop?: PaintLoop | undefined; delegate?: MobileScrollDelegate | undefined };

/**
 * Where a finger scrolls: the paint loop at full frame rate and the pages drawn while they glide.
 * Elsewhere the engine stays as it is.
 */
export const smoothTouchScrolling = (
  win: Pick<Window, "matchMedia" | "clearTimeout">,
  { loop, delegate }: TouchScrolling,
): void => {
  if (!isTouchScreen(win)) return;
  if (loop) paintEveryFrame(loop, (id) => win.clearTimeout(id));
  if (delegate) drawPagesWhileGliding(delegate);
};
