import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { collectErrors, credentialsFor, expectEditorReady, signUp, upload } from "./app";

const helloDocx = join(import.meta.dirname, "../test-files/hello.docx");

/** A phone held upright, as in Kontext's tab "Dokumente" or a phone's browser. */
const PHONE_WIDTH = 390;
test.use({ viewport: { width: PHONE_WIDTH, height: 800 }, isMobile: true, hasTouch: true });

/**
 * The page is as wide as the screen: nothing to scroll sideways, nothing cut off at the edge. Not
 * against `innerWidth`: on a phone the layout viewport grows with a page that is too wide.
 */
const expectFitsTheScreen = async (page: Page) =>
  expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(PHONE_WIDTH);

test("files and the editor fit a phone's screen", async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await signUp(page, credentialsFor(testInfo));
  await page.goto("/");
  await upload(page, helloDocx, "hello.docx");
  await expectFitsTheScreen(page);

  await page.getByRole("link", { name: "hello.docx", exact: true }).click();
  await expectEditorReady(page, errors);
  await expectFitsTheScreen(page);
  // The document gets the room: one row of buttons, which show only their icons and keep their names.
  await expect(page.getByRole("button", { name: "Speichern", exact: true })).toBeInViewport();
  await expect(page.getByRole("toolbar", { name: "Formatierung" })).toBeHidden();
  await expect(page.getByRole("menubar", { name: "Menü" })).toBeHidden();

  // The menus, the file's buttons and the toolbar come with "Werkzeuge".
  await page.getByRole("button", { name: "Werkzeuge" }).click();
  await expect(page.getByRole("menubar", { name: "Menü" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Teilen", exact: true })).toBeInViewport();
  await expect(page.getByRole("toolbar", { name: "Formatierung" })).toBeInViewport();
  await expectFitsTheScreen(page);
});

/** Whether the engine shows the mobile view (word/Drawing/HtmlPage.js IsReaderMode); tests only. */
const inMobileView = async (page: Page): Promise<boolean> => {
  const frame = await (await page.getByTestId("engine-frame").elementHandle())?.contentFrame();
  if (!frame) throw new Error("No engine frame.");
  return frame.evaluate(
    () =>
      (
        window as unknown as { editor?: { WordControl: { IsReaderMode(): boolean } } }
      ).editor?.WordControl.IsReaderMode() ?? false,
  );
};

/** "Als PDF herunterladen", without what changes from one PDF to the next (its time and id). */
const downloadPdf = async (page: Page): Promise<string> => {
  await page.getByRole("menubar").getByRole("menuitem", { name: "Datei", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Als PDF herunterladen" }).click();
  const pdf = (await readFile((await (await download).path()) as string)).toString("latin1");
  return pdf.replace(/\/(CreationDate|ModDate) *\([^)]*\)|\/ID *\[[^\]]*\]|<xmp:\w+Date>[^<]*/g, "");
};

test("a text document opens in the mobile view and its PDF keeps the pages", async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await signUp(page, credentialsFor(testInfo));
  await page.goto("/");
  await upload(page, helloDocx, "hello.docx");
  await page.getByRole("link", { name: "hello.docx", exact: true }).click();
  await expectEditorReady(page, errors);
  await expect.poll(() => inMobileView(page)).toBe(true);

  // The PDF is drawn from the pages, not from the screen's width: the same as with the pages shown.
  await page.getByRole("button", { name: "Werkzeuge" }).click();
  const fromMobileView = await downloadPdf(page);
  expect(await inMobileView(page)).toBe(true);

  // "Ansicht" switches back to the pages.
  await page.getByRole("menubar").getByRole("menuitem", { name: "Ansicht", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: "Mobilansicht" }).click();
  await expect.poll(() => inMobileView(page)).toBe(false);
  expect(fromMobileView).toEqual(await downloadPdf(page));
});

test("a presentation keeps its slide list under the slide and its notes hidden", async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);
  await signUp(page, credentialsFor(testInfo));
  await page.goto("/");
  await upload(page, join(import.meta.dirname, "../test-files/vortrag.pptx"), "vortrag.pptx");
  await page.getByRole("link", { name: "vortrag.pptx", exact: true }).click();
  await expectEditorReady(page, errors);
  const frame = await (await page.getByTestId("engine-frame").elementHandle())?.contentFrame();
  if (!frame) throw new Error("No engine frame.");
  // slide/api.js thumbnailsPosition, as the config "thumbnails-position" set it; tests only.
  const position = await frame.evaluate(() => {
    const win = window as unknown as {
      editor: { thumbnailsPosition: number };
      AscCommon: { thumbnailsPositionMap: { bottom: number } };
    };
    return win.editor.thumbnailsPosition === win.AscCommon.thumbnailsPositionMap.bottom;
  });
  expect(position).toBe(true);

  await page.getByRole("button", { name: "Werkzeuge" }).click();
  await page.getByRole("menubar").getByRole("menuitem", { name: "Ansicht", exact: true }).click();
  await expect(page.getByRole("menuitemcheckbox", { name: "Notizen" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  // The mobile mode switches the notes off; slide.ts allows them again, so the menu shows them.
  await page.getByRole("menuitemcheckbox", { name: "Notizen" }).click();
  const shown = () =>
    frame.evaluate(() =>
      (
        window as unknown as { editor: { WordControl: { IsNotesShown(): boolean } } }
      ).editor.WordControl.IsNotesShown(),
    );
  await expect.poll(shown).toBe(true);
  expect(errors).toEqual([]);
});

/**
 * How the engine's paint loop runs (common/Drawings/WorkEvents.js PaintMessageLoop on
 * HtmlPage.js WordControl); tests only.
 */
const paintLoop = async (page: Page) => {
  const frame = await (await page.getByTestId("engine-frame").elementHandle())?.contentFrame();
  if (!frame) throw new Error("No engine frame.");
  return frame.evaluate(() => {
    const loop = (
      window as unknown as {
        editor?: {
          WordControl: { paintMessageLoop: { isUseInterval: boolean; isUseRequestAnimationFrame: boolean } };
        };
      }
    ).editor?.WordControl.paintMessageLoop;
    return { everyFrame: loop?.isUseInterval === false, animationFrames: loop?.isUseRequestAnimationFrame };
  });
};

/**
 * Whether the text engine holds its pages back while they glide after a flick: its touch manager
 * scrolls as iScroll does then (common/Scrolls/mobileTouchManagerBase.js ScrollTo, isAnimating),
 * without a direction, so nothing moves; tests only.
 */
const holdsPagesWhileGliding = async (page: Page): Promise<boolean | undefined> => {
  const frame = await (await page.getByTestId("engine-frame").elementHandle())?.contentFrame();
  if (!frame) throw new Error("No engine frame.");
  return frame.evaluate(() => {
    const control = (
      window as unknown as {
        editor?: {
          WordControl: {
            NoneRepaintPages: boolean;
            MobileTouchManager: { delegate: { ScrollTo(scroll: object): void } } | null;
          };
        };
      }
    ).editor?.WordControl;
    control?.MobileTouchManager?.delegate.ScrollTo({ isAnimating: true, directionLocked: 0 });
    return control?.NoneRepaintPages;
  });
};

test("a text document draws its pages while they glide after a flick", async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await signUp(page, credentialsFor(testInfo));
  await page.goto("/");
  await upload(page, helloDocx, "hello.docx");
  await page.getByRole("link", { name: "hello.docx", exact: true }).click();
  await expectEditorReady(page, errors);
  expect(await holdsPagesWhileGliding(page)).toBe(false);
  expect(errors).toEqual([]);
});

test.describe("on a screen as dense as today's phones", () => {
  test.use({ deviceScaleFactor: 3.5 });

  test("the engine draws at density 2 and lays the mobile view out at a size to read", async ({
    page,
  }, testInfo) => {
    const errors = collectErrors(page);
    await signUp(page, credentialsFor(testInfo));
    await page.goto("/");
    await upload(page, helloDocx, "hello.docx");
    await page.getByRole("link", { name: "hello.docx", exact: true }).click();
    await expectEditorReady(page, errors);
    await expect.poll(() => inMobileView(page)).toBe(true);
    const frame = await (await page.getByTestId("engine-frame").elementHandle())?.contentFrame();
    if (!frame) throw new Error("No engine frame.");
    // common/browser.js AscBrowser.retinaPixelRatio and word/Drawing/HtmlPage.js ReaderFontSizes; tests only.
    const drawn = await frame.evaluate(() => {
      const win = window as unknown as {
        AscCommon: { AscBrowser: { retinaPixelRatio: number } };
        editor: { WordControl: { ReaderFontSizes: number[]; ReaderFontSizeCur: number } };
      };
      const control = win.editor.WordControl;
      return {
        pixelRatio: win.AscCommon.AscBrowser.retinaPixelRatio,
        fontSize: control.ReaderFontSizes[control.ReaderFontSizeCur],
      };
    });
    expect(drawn).toEqual({ pixelRatio: 2, fontSize: 22 });
    expect(errors).toEqual([]);
  });
});

for (const file of ["hello.docx", "vortrag.pptx"]) {
  test(`${file} draws on every frame while a finger scrolls, not every 40 ms`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await signUp(page, credentialsFor(testInfo));
    await page.goto("/");
    await upload(page, join(import.meta.dirname, "../test-files", file), file);
    await page.getByRole("link", { name: file, exact: true }).click();
    await expectEditorReady(page, errors);
    expect(await paintLoop(page)).toEqual({ everyFrame: true, animationFrames: true });
    expect(errors).toEqual([]);
  });
}

test("a PDF gives its pages the width of the screen, without the page thumbnails beside them", async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);
  await signUp(page, credentialsFor(testInfo));
  await page.goto("/");
  await upload(page, join(import.meta.dirname, "../test-files/formular.pdf"), "formular.pdf");
  await page.getByRole("link", { name: "formular.pdf", exact: true }).click();
  await expectEditorReady(page, errors);
  const frame = await (await page.getByTestId("engine-frame").elementHandle())?.contentFrame();
  if (!frame) throw new Error("No engine frame.");
  // The host page's elements (engine/frame/editor/pdf/main/index.html).
  const layout = await frame.evaluate(() => ({
    pages: document.getElementById("editor_sdk")?.getBoundingClientRect().left,
    thumbnails: document.getElementById("thumbnails-list")?.getBoundingClientRect().width,
  }));
  expect(layout).toEqual({ pages: 0, thumbnails: 0 });
  expect(errors).toEqual([]);
});

test("the menus stay on a phone's screen", async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await signUp(page, credentialsFor(testInfo));
  await page.goto("/");
  await upload(page, helloDocx, "hello.docx");
  await page.getByRole("link", { name: "hello.docx", exact: true }).click();
  await expectEditorReady(page, errors);

  await page.getByRole("button", { name: "Werkzeuge" }).click();
  const menus = await page.getByRole("menubar").getByRole("menuitem").allTextContents();
  const offScreen: string[] = [];
  for (const name of menus) {
    await page.getByRole("menubar").getByRole("menuitem", { name, exact: true }).click();
    const box = await page.getByRole("menu", { name }).boundingBox();
    if (!box || box.x < 0 || box.x + box.width > PHONE_WIDTH) offScreen.push(name);
    await page.keyboard.press("Escape");
  }
  expect(offScreen).toEqual([]);
});

for (const file of ["hello.docx", "preise.xlsx", "vortrag.pptx", "rechnung.pdf"]) {
  test(`${file} runs the engine in its mobile mode on a phone`, async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await signUp(page, credentialsFor(testInfo));
    await page.goto("/");
    await upload(page, join(import.meta.dirname, "../test-files", file), file);
    await page.getByRole("link", { name: file, exact: true }).click();
    await expectEditorReady(page, errors);
    const frame = await (await page.getByTestId("engine-frame").elementHandle())?.contentFrame();
    if (!frame) throw new Error("No engine frame.");
    // common/apiBase.js: `mobile: true` in the config (paint-loop.ts mobileConfig).
    const mobile = await frame.evaluate(
      () =>
        (window as unknown as { Asc: { editor?: { isMobileVersion?: boolean } } }).Asc.editor
          ?.isMobileVersion,
    );
    expect(mobile).toBe(true);
    // Only the engine's own errors: Chrome reports the spreadsheet's unload handler
    // (cell/view/WorkbookView.js) as a permissions policy violation, in any mode.
    expect(errors.filter((line) => line.includes("[engine]"))).toEqual([]);
  });
}
