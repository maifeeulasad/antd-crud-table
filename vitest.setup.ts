import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { Modal } from 'antd';

// Testing Library registers its own cleanup only when Vitest globals are
// enabled, and they are not. Without this, every render in a file accumulates
// in the same document and `screen` queries match elements left behind by
// earlier tests.
afterEach(cleanup);

// Static calls - Modal.confirm, message.* - mount their own React roots onto
// document.body, and Testing Library's cleanup only unmounts the roots it
// created. destroyAll animates rather than removing synchronously, so the
// portals are swept as well; otherwise a confirmation dialog survives into the
// next test and queries match leftovers from an earlier one.
afterEach(async () => {
  Modal.destroyAll();
  // destroyAll closes with an animation, so the portal is still attached on
  // the next tick; yielding lets it detach before the following test queries.
  await new Promise((resolve) => setTimeout(resolve, 0));
});

// jsdom lacks matchMedia, which antd's message/notification rely on
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom implements neither ResizeObserver nor scrollTo, both of which antd's
// table, dropdown and modal reach for on mount. Without them the components
// still render but log unhandled errors that drown the test output.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

if (typeof window !== 'undefined' && !window.scrollTo) {
  window.scrollTo = () => {};
}
