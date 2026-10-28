export {};

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    __recall: unknown;
  }
}
