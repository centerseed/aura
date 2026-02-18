// Must run before tsx/Next.js loads any modules
const { AsyncLocalStorage } = require('async_hooks');
globalThis.AsyncLocalStorage = AsyncLocalStorage;
