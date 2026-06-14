import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Limpia el DOM, mocks y almacenamiento entre pruebas
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  try { localStorage.clear(); } catch {}
});

// localStorage mínimo para entorno jsdom (api.js lo usa)
if (typeof localStorage === 'undefined') {
  let store = {};
  global.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
}
