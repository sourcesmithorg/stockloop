/**
 * Single error type for both API modes so screens catch one class whether
 * VITE_USE_MOCK is on or off. Lives outside api.ts to keep the mock layer
 * free of runtime imports from the module that selects it.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
