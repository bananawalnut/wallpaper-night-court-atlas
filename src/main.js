const host = {
  apiVersion: "1.0",
  applyPreferences() {},
  performAction() {},
  setVisible(isVisible) {
    document.documentElement.toggleAttribute("data-wallpaper-hidden", !isVisible);
  },
  dispose() {},
};

globalThis.wallpaperHost = host;
document.dispatchEvent(new Event("wallpaper-host-ready"));
window.webkit?.messageHandlers?.zenithRuntime?.postMessage({
  type: "ready",
  apiVersion: host.apiVersion,
  capabilities: [],
});

