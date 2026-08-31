const HOST_API_VERSION = "1.0.0";

function createBrowserBridge() {
  const target = new EventTarget();
  const bridge = {
    apiVersion: HOST_API_VERSION,
    capabilities: Object.freeze(["events"]),
    addEventListener(type, listener, options) {
      target.addEventListener(type, listener, options);
    },
    removeEventListener(type, listener, options) {
      target.removeEventListener(type, listener, options);
    },
    on(type, listener, options) {
      bridge.addEventListener(type, listener, options);
      return () => bridge.removeEventListener(type, listener, options);
    },
    off(type, listener, options) {
      bridge.removeEventListener(type, listener, options);
    },
    ready(metadata = {}) {
      queueMicrotask(() => target.dispatchEvent(new CustomEvent("host-ready", {
        detail: {
          hostApiVersion: HOST_API_VERSION,
          wallpaperApiVersion: metadata.apiVersion ?? "1.0",
          capabilities: Array.isArray(metadata.capabilities) ? metadata.capabilities : [],
        },
      })));
    },
    async requestNotification() {
      return { status: "unavailable", reason: "native-host-required" };
    },
  };
  return Object.freeze(bridge);
}

export const zenithWallpaper = globalThis.zenithWallpaper ?? createBrowserBridge();
export { HOST_API_VERSION };

if (!globalThis.zenithWallpaper) {
  Object.defineProperty(globalThis, "zenithWallpaper", {
    configurable: true,
    enumerable: true,
    writable: false,
    value: zenithWallpaper,
  });
}

