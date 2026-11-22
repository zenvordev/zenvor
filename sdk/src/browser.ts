export * from "./types.js";
export { ZenvorError } from "./errors.js";
import { ZenvorError } from "./errors.js";
export class ZenvorClient {
  constructor(..._args: unknown[]) {
    throw new ZenvorError(
      "SERVER_ONLY",
      "API credentials are server-only. Import @zenvorprotocol/sdk/wallet in browsers.",
    );
  }
}
