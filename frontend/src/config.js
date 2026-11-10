// Backend connection settings. Override in a `.env.local` file (see `.env.example`).
const trimSlash = (url) => url.replace(/\/+$/, '');

export const API_URL = trimSlash(import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000');

// Defaults to the API host with ws:// or wss:// swapped in.
export const WS_URL = trimSlash(import.meta.env.VITE_WS_URL || API_URL.replace(/^http/, 'ws'));

export const USER_ID = import.meta.env.VITE_USER_ID || 'test_user_123';
