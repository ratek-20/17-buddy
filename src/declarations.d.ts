/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
/// <reference types="svelte" />
/// <reference types="vite/client" />

import type { DraftOverlayApi } from './ipc/draft-overlay';

declare global {
  interface Window {
    draftOverlay: DraftOverlayApi;
  }
}

export {};
