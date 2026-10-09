import '@testing-library/jest-dom';

// Polyfill ResizeObserver and DOMMatrixReadOnly for React Flow & Recharts in jsdom
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as any;

if (typeof window !== 'undefined' && !window.DOMMatrixReadOnly) {
  (window as any).DOMMatrixReadOnly = class DOMMatrixReadOnly {
    m22 = 1;
    isIdentity = true;
    inverse() {
      return this;
    }
  };
}
