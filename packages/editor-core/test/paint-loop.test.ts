import { describe, expect, it } from "vitest";
import { isTouchScreen, type PaintLoop, paintEveryFrame, smoothTouchScrolling } from "../src/paint-loop";

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

  it("changes the loop only where a finger is the main pointer", () => {
    const desktop = fakeLoop().loop;
    smoothTouchScrolling(screen(false), desktop);
    expect(desktop.isUseInterval).toBe(true);

    const phone = fakeLoop().loop;
    smoothTouchScrolling(screen(true), phone);
    expect(phone.isUseInterval).toBe(false);

    expect(() => smoothTouchScrolling(screen(true), undefined)).not.toThrow();
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
