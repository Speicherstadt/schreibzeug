import { type LayoutCommands, LINE_SPACINGS } from "@schreibzeug/editor-core";
import { m } from "../paraglide/messages";
import { getLocale } from "../paraglide/runtime";
import type { MenuItem } from "../ui/menu";

/*
 * Line spacing for the toolbar's button and the editor's "Format" menu (layout-menus.ts). It sits in
 * toolbar/, below editor/, so that the two do not import each other.
 */

/** 1.15 → "1,15" in German, "1.15" in English: the decimals of the interface language. */
export const formatSpacing = (multiple: number): string =>
  multiple.toLocaleString(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/** One entry per line spacing; the label says what it is where the context does not. */
export const lineSpacingItems = (
  lineSpacing: number | null,
  layout: LayoutCommands | null,
  disabled: boolean,
  label: (multiple: number) => string = (multiple) =>
    m.layout_menus_line_spacing({ spacing: formatSpacing(multiple) }),
): MenuItem[] =>
  LINE_SPACINGS.map((multiple) => ({
    label: label(multiple),
    checked: lineSpacing === multiple,
    disabled,
    onSelect: () => layout?.setLineSpacing(multiple),
  }));
