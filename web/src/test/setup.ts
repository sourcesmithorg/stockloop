import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Auto-cleanup needs a global afterEach; this project imports vitest APIs
// explicitly, so wire cleanup manually.
afterEach(cleanup);

// jsdom's File/Blob lacks .text() (real browsers and Node both implement it);
// the import preview reads uploaded files with it.
if (typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function text(): Promise<string> {
    const { promise, resolve, reject } = Promise.withResolvers<string>();
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(this);
    return promise;
  };
}
