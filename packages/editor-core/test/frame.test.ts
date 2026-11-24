import { describe, expect, it } from "vitest";
import { framePath, keepFocusOnClick, mountEngineFrame } from "../src/frame";
import { createStore } from "../src/store";

describe("framePath", () => {
  it("points four folders below the engine root, where sdkjs expects its host page", () => {
    expect(framePath("word")).toBe("/engine/frame/editor/word/main/index.html");
  });

  it("has a host page for the PDF editor beside the Office editors", () => {
    expect(framePath("pdf")).toBe("/engine/frame/editor/pdf/main/index.html");
  });

  it("accepts an engine path with or without a trailing slash", () => {
    expect(framePath("word", "/assets/engine/")).toBe("/assets/engine/frame/editor/word/main/index.html");
  });
});

describe("mountEngineFrame", () => {
  it("adds an iframe for the engine page", () => {
    const container = document.createElement("div");
    void mountEngineFrame(container, { kind: "word", timeoutMs: 5 }).catch(() => {});
    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe("/engine/frame/editor/word/main/index.html");
  });

  it("removes the iframe and fails when the engine does not load", async () => {
    const container = document.createElement("div");
    await expect(mountEngineFrame(container, { kind: "word", timeoutMs: 5 })).rejects.toThrow("did not load");
    expect(container.querySelector("iframe")).toBeNull();
  });
});

describe("keepFocusOnClick", () => {
  const fakeFrame = (focused: boolean, active: "body" | "input") => {
    const target = new EventTarget();
    const body = {};
    let focusCalls = 0;
    const input = {
      focus: () => {
        focusCalls += 1;
      },
    };
    const win = {
      addEventListener: target.addEventListener.bind(target),
      document: { hasFocus: () => focused, body, activeElement: active === "body" ? body : input },
    };
    keepFocusOnClick(win as never, () => input as never);
    return {
      press: () => target.dispatchEvent(new Event("pointerdown")),
      release: (button = 0) => target.dispatchEvent(Object.assign(new Event("pointerup"), { button })),
      focusCalls: () => focusCalls,
    };
  };

  it("focuses the engine's input when a press lands in the frame while focus is elsewhere", () => {
    const frame = fakeFrame(false, "input");
    frame.press();
    expect(frame.focusCalls()).toBe(1);
  });

  it("focuses the input when the frame has focus but nothing in it holds the keys", () => {
    const frame = fakeFrame(true, "body");
    frame.press();
    expect(frame.focusCalls()).toBe(1);
  });

  it("checks again on release, where the engine left the keys with the page", () => {
    const frame = fakeFrame(true, "body");
    frame.release();
    expect(frame.focusCalls()).toBe(1);
    frame.release(2);
    expect(frame.focusCalls()).toBe(1);
  });

  it("leaves focus alone when the engine already has it", () => {
    const frame = fakeFrame(true, "input");
    frame.press();
    frame.release();
    expect(frame.focusCalls()).toBe(0);
  });
});

describe("keepFocusOnClick with the engine's iOS input", () => {
  const touch = (type: string, x: number, y: number, fingers = 1) =>
    Object.assign(new Event(type), {
      changedTouches: [{ clientX: x, clientY: y }],
      touches:
        type === "touchstart" ? Array.from({ length: fingers }, () => ({ clientX: x, clientY: y })) : [],
    });
  const fakeIosFrame = () => {
    const target = new EventTarget();
    const body = {};
    const calls: string[] = [];
    const input = { tagName: "DIV", focus: () => calls.push("focus") };
    const win = {
      addEventListener: target.addEventListener.bind(target),
      document: { hasFocus: () => false, body, activeElement: body },
      AscCommon: {
        g_inputContext: {
          showKeyboard: () => calls.push("showKeyboard"),
          setReadOnlyWrapper: (readOnly: boolean) => calls.push(`readOnly ${readOnly}`),
        },
      },
    };
    keepFocusOnClick(win as never, () => input as never);
    const focusOut = (from: unknown) =>
      Object.defineProperty(new Event("focusout"), "target", { value: from });
    return { dispatch: (event: Event) => target.dispatchEvent(event), calls, input, focusOut };
  };

  it("switches the input on and focuses it once a tap ends, not when the finger lands", () => {
    const frame = fakeIosFrame();
    frame.dispatch(touch("touchstart", 100, 200));
    frame.dispatch(new Event("pointerdown"));
    expect(frame.calls).toEqual([]);
    frame.dispatch(touch("touchend", 104, 203));
    expect(frame.calls).toEqual(["showKeyboard", "focus"]);
  });

  it("opens no keyboard after a finger scrolled or two fingers zoomed", () => {
    const frame = fakeIosFrame();
    frame.dispatch(touch("touchstart", 100, 200));
    frame.dispatch(touch("touchend", 100, 320));
    frame.dispatch(touch("touchstart", 100, 200, 2));
    frame.dispatch(touch("touchend", 100, 200));
    expect(frame.calls).toEqual([]);
  });

  it("switches the input off again once the keyboard closes, so the next scroll brings none up", () => {
    const frame = fakeIosFrame();
    frame.dispatch(touch("touchstart", 100, 200));
    frame.dispatch(touch("touchend", 100, 200));
    frame.dispatch(frame.focusOut({}));
    frame.dispatch(frame.focusOut(frame.input));
    expect(frame.calls).toEqual(["showKeyboard", "focus", "readOnly true"]);
  });
});

describe("createStore", () => {
  it("does not notify when the state stays the same", () => {
    const store = createStore({ n: 1 });
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.set((state) => state);
    store.set((state) => ({ n: state.n + 1 }));
    expect(calls).toBe(1);
    expect(store.get().n).toBe(2);
  });
});
