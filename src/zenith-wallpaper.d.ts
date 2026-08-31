export type WallpaperHostEventMap = {
  "host-ready": {
    hostApiVersion: string;
    wallpaperApiVersion: string;
    capabilities: string[];
  };
  "preferences-change": { reducedMotion: boolean };
  action: { id: string };
  "visibility-change": { visible: boolean };
};

export type NotificationResult = {
  status: "unavailable";
  reason: "publish-to-declared-feed";
};

export interface ZenithWallpaperHost {
  readonly apiVersion: string;
  readonly capabilities: readonly string[];
  addEventListener<K extends keyof WallpaperHostEventMap>(
    type: K,
    listener: (event: CustomEvent<WallpaperHostEventMap[K]>) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  removeEventListener<K extends keyof WallpaperHostEventMap>(
    type: K,
    listener: (event: CustomEvent<WallpaperHostEventMap[K]>) => void,
    options?: EventListenerOptions | boolean,
  ): void;
  on<K extends keyof WallpaperHostEventMap>(
    type: K,
    listener: (event: CustomEvent<WallpaperHostEventMap[K]>) => void,
    options?: AddEventListenerOptions | boolean,
  ): () => void;
  off<K extends keyof WallpaperHostEventMap>(
    type: K,
    listener: (event: CustomEvent<WallpaperHostEventMap[K]>) => void,
    options?: EventListenerOptions | boolean,
  ): void;
  ready(metadata?: { apiVersion?: string; capabilities?: string[] }): void;
  /** @deprecated Publish an item to the read-only feed declared in publication.json. */
  requestNotification(): Promise<NotificationResult>;
}

export const HOST_API_VERSION: "1.1.0";
export const zenithWallpaper: ZenithWallpaperHost;

declare global {
  var zenithWallpaper: ZenithWallpaperHost;
}
