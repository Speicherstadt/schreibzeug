/*
 * Caps the pixel density the engine draws at on a touch screen, before sdkjs loads.
 *
 * sdkjs sizes every canvas from window.devicePixelRatio (common/device_scale.js
 * checkDeviceScale → common/browser.js checkZoom → AscBrowser.retinaPixelRatio). A phone at 3 or
 * 3.5 makes the page canvas more than twice the pixels of 2, and redrawing it while a finger
 * scrolls does not keep up with the screen. At 2 the text is a little less sharp and scrolling is
 * smooth (docs/engine.md, "Scrollen auf dem Touch-Bildschirm"). Only where a finger is the main
 * pointer, as packages/editor-core/src/paint-loop.ts decides; the browser's own value stays the
 * source, so a zoom still counts.
 */
(function () {
  var MAX_PIXEL_RATIO = 2;
  var coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  if (!coarse) return;
  var owner = window;
  var descriptor = null;
  while (owner && !descriptor) {
    descriptor = Object.getOwnPropertyDescriptor(owner, "devicePixelRatio");
    owner = Object.getPrototypeOf(owner);
  }
  if (!descriptor) return;
  var read = descriptor.get
    ? function () {
        return descriptor.get.call(window);
      }
    : function () {
        return descriptor.value;
      };
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    get: function () {
      return Math.min(read(), MAX_PIXEL_RATIO);
    },
  });
})();
