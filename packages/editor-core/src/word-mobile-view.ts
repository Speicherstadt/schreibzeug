/**
 * The text engine's mobile view (word/Drawing/HtmlPage.js ChangeReaderMode with isNewReaderMode):
 * the text flows in the width of the screen at a size to read and stays editable, as web-apps'
 * mobile text editor opens every document on a phone (documenteditor/mobile Main.jsx,
 * "mobile-view"). It is a layout only (word/Editor/Document.js SetDocumentReadMode,
 * word/Editor/Layout/ReadView.js, set without history): the document and the saved file stay as
 * they are. The rulers measure the page, so they go with it.
 */
import type { WordEngineApi } from "./engine-types";

export type MobileViewCommands = {
  /** Shows the text in the mobile view, or the pages again. */
  set: (on: boolean) => void;
};

/** The engine area in CSS pixels and the pixel density the engine draws at. */
export type EngineScreen = { width: number; pixelRatio: number };

type MobileViewApi = Pick<WordEngineApi, "ChangeReaderMode" | "asc_SetViewRulers" | "zoomFitToWidth"> & {
  WordControl: Pick<
    WordEngineApi["WordControl"],
    "IsReaderMode" | "m_oLogicDocument" | "ReaderFontSizes" | "ReaderFontSizeCur"
  >;
};

/**
 * The mobile view's text grows with the screen's width and pixel density: word/Drawing/HtmlPage.js
 * SetNewMobileMode lays the text out on the page width divided by the density and fits that to
 * the screen, scaled by the reader font size over 16. Measured on a phone 393 px wide at density
 * 2, the size 22 gives body text of about 18 CSS pixels, five or six words a line; the engine's
 * default 16 gives 13. The size is chosen so other screens get about the same.
 */
const READING = { fontSize: 22, width: 393, pixelRatio: 2 };

/** The engine's reader font size (of `sizes`, word/Drawing/HtmlPage.js ReaderFontSizes) for this screen. */
export const readingFontSize = (sizes: readonly number[], { width, pixelRatio }: EngineScreen): number => {
  const wanted = (READING.fontSize * READING.width * READING.pixelRatio) / (width * pixelRatio);
  return sizes.reduce((best, size) => (Math.abs(size - wanted) < Math.abs(best - wanted) ? size : best));
};

export const createMobileViewCommands = (
  api: MobileViewApi,
  screen: () => EngineScreen,
): MobileViewCommands => ({
  set: (on) => {
    // ChangeReaderMode switches; the engine says which way it stands.
    if (api.WordControl.IsReaderMode() !== on) {
      // Read by SetNewMobileMode as the view comes on, so the text is laid out once, at that size;
      // IncreaseReaderFontSize would lay it out again for every step.
      if (on) {
        const sizes = api.WordControl.ReaderFontSizes;
        api.WordControl.ReaderFontSizeCur = sizes.indexOf(readingFontSize(sizes, screen()));
      }
      api.ChangeReaderMode();
    }
    api.asc_SetViewRulers(!on);
    api.zoomFitToWidth();
  },
});

/**
 * Runs `draw` on the pages, also while the mobile view shows: the PDF and printing need the
 * document's own pages. The pages are laid out at once, as word/api.js asc_Print does before it
 * prints (RecalculateAllAtOnce); the mobile view comes back afterwards.
 */
export const onPages = <T>(api: MobileViewApi, draw: () => T): T => {
  if (!api.WordControl.IsReaderMode()) return draw();
  api.ChangeReaderMode();
  api.WordControl.m_oLogicDocument.RecalculateAllAtOnce(true);
  try {
    return draw();
  } finally {
    api.ChangeReaderMode();
  }
};
