import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Auto-cleanup needs a global afterEach; this project imports vitest APIs
// explicitly, so wire cleanup manually.
afterEach(cleanup);
