/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'true' (default) serves the fixture layer in src/lib/mock; 'false' hits the real /api proxy. */
  readonly VITE_USE_MOCK?: string;
}
