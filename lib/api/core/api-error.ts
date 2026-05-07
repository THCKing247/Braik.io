/**
 * Structured API failure from Braik JSON routes (`{ error?: string, ... }`) or non-JSON bodies.
 */
export class ApiError extends Error {
  override readonly name = "ApiError"

  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
    /** Server correlation id when the route sets `X-Request-Id` / `x-request-id`. */
    readonly requestId?: string | null
  ) {
    super(message)
  }
}
