/**
 * Single error type for both API modes so screens catch one class whether
 * VITE_USE_MOCK is on or off. Lives outside api.ts to keep the mock layer
 * free of runtime imports from the module that selects it.
 */
export interface ApiErrorDetail {
  code?: string;
  message?: string;
  field?: string;
  currentVersion?: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly field?: string;
  readonly currentVersion?: number;

  constructor(status: number, message: string, detail?: ApiErrorDetail) {
    super(detail?.message ?? message);
    this.name = 'ApiError';
    this.status = status;
    this.code = detail?.code;
    this.field = detail?.field;
    this.currentVersion = detail?.currentVersion;
  }
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
