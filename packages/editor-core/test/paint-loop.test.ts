import { describe, expect, it } from "vitest";
import {
  drawPagesWhileGliding,
  isTouchScreen,
  type MobileScrollDelegate,
  type PaintLoop,
  paintEveryFrame,
  smoothTouchScrolling,
} from "../src/paint-loop";

/** common/Drawings/WorkEvents.js PaintMessageLoop as the engine makes it, with what was started. */
const fakeLoop = (overrides: Partial<PaintLoop> = {}) => {
  const started: Array<() => void> = [];
  const loop: PaintLoop = {
    isUseInterval: true,
    isUseRequestAnimationFrame: true,
    requestAnimationFrame: () => 1,
    id: null,
    engine: null,
    Start: (engine) => {
      started.push(engine);
      loop.engine = engine;
      loop.id = 99;
    },
    ...overrides,
  };
  return { loop, started };
};

/**
 * mobileTouchManagerBase.js CMobileDelegateEditor: ScrollTo holds the pages back while the scroll
 * animates. `glide` scrolls as after a flick and tells whether the pages are held back then.
 */
const fakeDelegate = () => {
  const scrolled: unknown[] = [];
  const delegate: MobileScrollDelegate = {
    prototype: {
      ScrollTo(scroll) {
        scrolled.push(scroll);
        this.HtmlPage.NoneRepaintPages = (scroll as { isAnimating: boolean }).isAnimating;
      },
    },
  };
  const glide = () => {
    const page = { HtmlPage: { NoneRepaintPages: false } };
    delegate.prototype.ScrollTo.call(page, { isAnimating: true });
    return page.HtmlPage.NoneRepaintPages;
  };
  return { delegate, glide, scrolled };
};

const screen = (coarse: boolean) => ({
  matchMedia: (query: string) => ({ matches: coarse && query === "(pointer: coarse)" }) as MediaQueryList,
  clearTimeout: () => {},
});

describe("paint loop", () => {
  it("draws on every frame instead of every 40 ms, in Chrome and Safari", () => {
    const { loop, started } = fakeLoop({ id: 7, engine: () => {} });
    paintEveryFrame(loop, () => {
      throw new Error("A frame request is no timer.");
    });
    expect(loop.isUseInterval).toBe(false);
    expect(started).toEqual([]);
    expect(loop.id).toBe(7);
  });

  it("moves a loop running on the 40 ms timer to animation frames", () => {
    const engine = () => {};
    const cleared: number[] = [];
    const { loop, started } = fakeLoop({ isUseRequestAnimationFrame: false, id: 7, engine });
    paintEveryFrame(loop, (id) => cleared.push(id));
    expect(cleared).toEqual([7]);
    expect(loop.isUseRequestAnimationFrame).toBe(true);
    expect(started).toEqual([engine]);
  });

  it("leaves a loop that has not started to the engine, which starts it on frames", () => {
    const { loop, started } = fakeLoop({ isUseRequestAnimationFrame: false });
    paintEveryFrame(loop, () => {
      throw new Error("Nothing runs yet.");
    });
    expect(loop.isUseRequestAnimationFrame).toBe(true);
    expect(loop.isUseInterval).toBe(false);
    expect(started).toEqual([]);
  });

  it("keeps the timer where the browser has no animation frames", () => {
    const { loop } = fakeLoop({ isUseRequestAnimationFrame: false, requestAnimationFrame: null, id: 7 });
    paintEveryFrame(loop, () => {
      throw new Error("The timer keeps running.");
    });
    expect(loop.isUseRequestAnimationFrame).toBe(false);
    expect(loop.id).toBe(7);
  });

  it("changes the engine only where a finger is the main pointer", () => {
    const desktop = fakeLoop().loop;
    const desktopDelegate = fakeDelegate();
    smoothTouchScrolling(screen(false), { loop: desktop, delegate: desktopDelegate.delegate });
    expect(desktop.isUseInterval).toBe(true);
    expect(desktopDelegate.glide()).toBe(true);

    const phone = fakeLoop().loop;
    const phoneDelegate = fakeDelegate();
    smoothTouchScrolling(screen(true), { loop: phone, delegate: phoneDelegate.delegate });
    expect(phone.isUseInterval).toBe(false);
    expect(phoneDelegate.glide()).toBe(false);

    expect(() => smoothTouchScrolling(screen(true), {})).not.toThrow();
  });

  it("draws the pages while they glide, and still scrolls as the engine does", () => {
    const { delegate, glide, scrolled } = fakeDelegate();
    drawPagesWhileGliding(delegate);
    expect(glide()).toBe(false);
    expect(scrolled).toEqual([{ isAnimating: true }]);
  });

  it("takes a browser without media queries for no touch screen", () => {
    expect(
      isTouchScreen({
        matchMedia: () => {
          throw new Error("no media queries");
        },
      }),
    ).toBe(false);
  });
});
