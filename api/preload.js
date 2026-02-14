// Polyfill: Next.js 16 expects globalThis.AsyncLocalStorage (native in Node 21+)
// Must run before tsx/Next.js module loading via --require preload.js
const { AsyncLocalStorage } = require('node:async_hooks');
if (!globalThis.AsyncLocalStorage) {
  globalThis.AsyncLocalStorage = AsyncLocalStorage;
}
