import { describe, expect, it } from "vitest";
import {
  type CursorLabel,
  type CursorLabelArgs,
  colorOf,
  cursorLabelSource,
  type ForeignCursors,
  hideLabel,
  keepCursorLabels,
  showLabel,
} from "../src/cursor-labels";

/** The engine's label events (word/api.js sync_ShowForeignCursorLabel) and its participant list. */
const fakeApi = (names: Record<string, string>) => {
  const callbacks: Partial<{ [N in keyof CursorLabelArgs]: (...args: CursorLabelArgs[N]) => void }> = {};
  const api = {
    asc_registerCallback: (name: keyof CursorLabelArgs, callback: (...args: never[]) => void) => {
      (callbacks as Record<string, unknown>)[name] = callback;
    },
    CoAuthoringApi: { getParticipantName: (id: string) => names[id] ?? "" },
  };
  return { api, callbacks };
};

const color = (r: number, g: number, b: number) => ({ get_r: () => r, get_g: () => g, get_b: () => b });

const anna: CursorLabel = { id: "anna-1", name: "Anna", color: "#ff8000", x: 10, y: 20 };

describe("cursor labels", () => {
  it("writes the engine's colour as #rrggbb", () => {
    expect(colorOf(color(255, 128, 0))).toBe("#ff8000");
    expect(colorOf(color(0, 5, 10))).toBe("#00050a");
  });

  it("keeps one label a person, at the newest place", () => {
    const moved = { ...anna, x: 50 };
    const ben = { ...anna, id: "ben-1", name: "Ben" };
    expect(showLabel(showLabel([anna, ben], moved), moved)).toEqual([ben, moved]);
    expect(hideLabel([anna, ben], "anna-1")).toEqual([ben]);
  });

  it("names the person and measures from the frame, as the engine reports labels", () => {
    const { api, callbacks } = fakeApi({ "anna-1": "Anna" });
    const subscribe = cursorLabelSource(api, () => ({
      getBoundingClientRect: () => ({ left: 100, top: 40 }),
    }));
    const seen: Array<readonly CursorLabel[]> = [];
    subscribe((labels) => seen.push(labels));
    callbacks.asc_onShowForeignCursorLabel?.("anna-1", 10, 20, color(255, 128, 0));
    callbacks.asc_onShowForeignCursorLabel?.("guest-2", 0, 0, color(0, 0, 0));
    callbacks.asc_onHideForeignCursorLabel?.("anna-1");
    expect(seen).toEqual([
      [],
      [{ ...anna, x: 110, y: 60 }],
      [
        { ...anna, x: 110, y: 60 },
        { id: "guest-2", name: "", color: "#000000", x: 100, y: 40 },
      ],
      [{ id: "guest-2", name: "", color: "#000000", x: 100, y: 40 }],
    ]);
  });

  it("gives a listener that comes later the labels shown already", () => {
    const { api, callbacks } = fakeApi({ "anna-1": "Anna" });
    const subscribe = cursorLabelSource(api, () => null);
    callbacks.asc_onShowForeignCursorLabel?.("anna-1", 10, 20, color(255, 128, 0));
    const seen: Array<readonly CursorLabel[]> = [];
    const stop = subscribe((labels) => seen.push(labels));
    stop();
    callbacks.asc_onHideForeignCursorLabel?.("anna-1");
    expect(seen).toEqual([[anna]]);
  });

  it("keeps the names up instead of taking them down after 1.5 s", () => {
    const asc = { FOREIGN_CURSOR_LABEL_HIDETIME: 1500 };
    keepCursorLabels(asc);
    expect(asc.FOREIGN_CURSOR_LABEL_HIDETIME).toBe(2 ** 31 - 1);
  });

  it("shows the name whenever another person's cursor is placed, after the engine placed it", () => {
    const calls: unknown[][] = [];
    const cursors: ForeignCursors = {
      Update_ForeignCursorPosition: (...args) => calls.push(["place", ...args]),
      Show_ForeignCursorLabel: (id) => calls.push(["label", id]),
    };
    keepCursorLabels({ CollaborativeEditing: cursors });
    cursors.Update_ForeignCursorPosition("anna-1", "run", 3, true);
    expect(calls).toEqual([
      ["place", "anna-1", "run", 3, true],
      ["label", "anna-1"],
    ]);
  });
});
