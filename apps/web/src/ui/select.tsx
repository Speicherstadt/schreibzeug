import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

/** The heights next to the fields around it: xs in the pivot panel, sm in the toolbar and e-invoice, md in forms. */
type Height = "xs" | "sm" | "md";

const heights: Record<Height, { select: string; chevron: number }> = {
  xs: { select: "h-7 pr-6 pl-2 text-xs", chevron: 12 },
  sm: { select: "h-8 pr-7 pl-2.5 text-sm", chevron: 14 },
  md: { select: "h-9 pr-8 pl-2.5 text-sm", chevron: 14 },
};

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  height?: Height;
  /** Classes for the frame around the select (width, alignment); the select fills it. */
  className?: string;
};

/**
 * A native select with a chevron of our own. The browser's arrow sits on the border and looks
 * different in every browser, so it is hidden and drawn here with room to the edge.
 */
export const Select = ({ height = "md", className = "", ...props }: SelectProps) => (
  <span className={`relative inline-flex items-center ${className}`}>
    <select
      {...props}
      className={`w-full min-w-0 appearance-none truncate rounded-md border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--foreground)] disabled:opacity-40 ${heights[height].select}`}
    />
    <ChevronDown
      size={heights[height].chevron}
      aria-hidden
      className="pointer-events-none absolute right-2 text-[var(--muted-foreground)]"
    />
  </span>
);
