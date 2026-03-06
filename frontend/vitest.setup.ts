import "@testing-library/jest-dom/vitest";

// Polyfill ResizeObserver for jsdom (used by cmdk / Radix popovers)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
