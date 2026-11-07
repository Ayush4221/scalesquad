import '@testing-library/jest-dom/vitest';
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
    onchange: null,
  }),
});
