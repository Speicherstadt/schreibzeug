import { describe, expect, it } from "vitest";
import { createMobileViewCommands, onPages, readingFontSize } from "../src/word-mobile-view";

/** word/Drawing/HtmlPage.js ReaderFontSizes */
const SIZES = [12, 14, 16, 18, 22, 28, 36, 48, 72];
const PHONE = { width: 393, pixelRatio: 2 };

/** The engine's switch between pages and the mobile view, with what was called in order. */
const fakeApi = (reader = false) => {
  const calls: string[] = [];
  let mode = reader;
  return {
    calls,
    api: {
      ChangeReaderMode: () => {
        mode = !mode;
        calls.push(mode ? "mobile view" : "pages");
      },
      asc_SetViewRulers: (show: boolean) => calls.push(show ? "rulers" : "no rulers"),
      zoomFitToWidth: () => calls.push("fit width"),
      WordControl: {
        IsReaderMode: () => mode,
        ReaderFontSizes: SIZES,
        ReaderFontSizeCur: 2,
        m_oLogicDocument: {
          RecalculateAllAtOnce: () => calls.push("lay out"),
          Get_MailMergedDocument: () => null,
          FieldsManager: { GetAllFieldsByType: () => [] },
        },
      },
    },
  };
};

describe("mobile view", () => {
  it("switches only when it is not on yet, without rulers, at the screen's width", () => {
    const { api, calls } = fakeApi();
    const view = createMobileViewCommands(api, () => PHONE);
    view.set(true);
    view.set(true);
    expect(calls).toEqual(["mobile view", "no rulers", "fit width", "no rulers", "fit width"]);
    view.set(false);
    expect(calls.slice(-3)).toEqual(["pages", "rulers", "fit width"]);
  });

  it("lays the text out at a size to read as the view comes on, and keeps it while it stays on", () => {
    const { api } = fakeApi();
    const view = createMobileViewCommands(api, () => PHONE);
    view.set(true);
    expect(api.WordControl.ReaderFontSizes[api.WordControl.ReaderFontSizeCur]).toBe(22);
    api.WordControl.ReaderFontSizeCur = 3;
    view.set(true);
    expect(api.WordControl.ReaderFontSizeCur).toBe(3);
  });

  it("picks about the same text size on other screens", () => {
    expect(readingFontSize(SIZES, PHONE)).toBe(22);
    // Today's phones at the full density 3.5, as the engine drew them before the cap.
    expect(readingFontSize(SIZES, { width: 393, pixelRatio: 3.5 })).toBe(12);
    expect(readingFontSize(SIZES, { width: 360, pixelRatio: 2 })).toBe(22);
    expect(readingFontSize(SIZES, { width: 800, pixelRatio: 2 })).toBe(12);
    expect(readingFontSize(SIZES, { width: 393, pixelRatio: 1 })).toBe(48);
  });

  it("draws the PDF from the pages and comes back to the mobile view", () => {
    const { api, calls } = fakeApi(true);
    const drawn = onPages(api, () => {
      calls.push("draw");
      return "commands";
    });
    expect(drawn).toBe("commands");
    expect(calls).toEqual(["pages", "lay out", "draw", "mobile view"]);
  });

  it("draws at once where the pages show", () => {
    const { api, calls } = fakeApi(false);
    onPages(api, () => calls.push("draw"));
    expect(calls).toEqual(["draw"]);
  });
});
