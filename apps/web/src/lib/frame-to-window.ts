/** Where the engine's frame sits in the window: the engine's points come in frame coordinates. */
export const frameToWindow = (container: HTMLElement | null, point: { x: number; y: number }) => {
  const frame = container?.querySelector("iframe")?.getBoundingClientRect();
  return { x: (frame?.left ?? 0) + point.x, y: (frame?.top ?? 0) + point.y };
};
