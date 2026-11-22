/** Never contains request bodies, tokens, credentials, URLs or raw response text. */
export class ZenvorError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly retryAfterSeconds?: number;
  constructor(
    code: string,
    message: string,
    status?: number,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ZenvorError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
export function invalid(message: string): never {
  throw new ZenvorError("INVALID_INPUT", message);
}
