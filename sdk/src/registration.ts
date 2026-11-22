import { Transport } from "./transport.js";
import { address, response, token } from "./validate.js";
import { invalid } from "./errors.js";
import type {
  TransportOptions,
  RequestOptions,
  RegistrationAction,
  RegistrationConfig,
  Challenge,
  RegistrationSession,
  IssuedKey,
  Hex,
} from "./types.js";
export type {
  RegistrationAction,
  RegistrationConfig,
  Challenge,
  RegistrationSession,
  IssuedKey,
  TransportOptions,
  RequestOptions,
} from "./types.js";
export { ZenvorError } from "./errors.js";
/** Free off-chain registration. The caller explicitly signs each key-management action. */
export class RegistrationClient {
  #transport: Transport;
  constructor(options: TransportOptions = {}) {
    this.#transport = new Transport(options);
  }
  async config(wallet?: string, options?: RequestOptions) {
    if (wallet !== undefined && !address(wallet))
      invalid("Invalid wallet address.");
    const r = await this.#transport.request<RegistrationConfig>(
      "/registration/config" + (wallet ? "?wallet=" + wallet : ""),
      undefined,
      options,
    );
    response(
      r.mode === "offchain" &&
        r.chainId === 4663 &&
        r.address === null &&
        r.codeHash === null &&
        r.request === null &&
        r.feeWei === "0" &&
        r.feeEth === "0" &&
        r.confirmations === 0 &&
        address(r.receiver) &&
        typeof r.hasApiKey === "boolean" &&
        (r.requesterKey === null || /^0x[\da-f]{64}$/i.test(r.requesterKey)) &&
        r.executionFee?.wei === "10000000000000" &&
        r.executionFee.asset === "ETH" &&
        address(r.executionFee.recipient) &&
        r.executionFee.recipient.toLowerCase() === r.receiver.toLowerCase(),
    );
    return r;
  }
  async challenge(
    wallet: string,
    action: RegistrationAction,
    options?: RequestOptions,
  ) {
    if (!address(wallet) || !["issue", "rotate", "revoke"].includes(action))
      invalid("Invalid wallet or registration action.");
    const r = await this.#transport.request<Challenge>(
      "/registration/challenge",
      { wallet, action },
      options,
    );
    response(
      typeof r.challenge === "string" &&
        typeof r.message === "string" &&
        Number.isFinite(r.expiresAt),
    );
    return r;
  }
  async authenticate(
    challenge: string,
    signature: Hex,
    options?: RequestOptions,
  ) {
    token(challenge);
    if (!/^0x[0-9a-f]{130}$/i.test(signature))
      invalid("A wallet message signature is required.");
    const r = await this.#transport.request<RegistrationSession>(
      "/registration/authenticate",
      { challenge, signature },
      options,
    );
    response(typeof r.session === "string" && address(r.wallet));
    return r;
  }
  async issueKey(session: string, options?: RequestOptions) {
    token(session);
    const r = await this.#transport.request<IssuedKey>(
      "/registration/key",
      { session },
      options,
    );
    response(
      (typeof r.apiKey === "string" || r.apiKey === null) &&
        address(r.wallet) &&
        typeof r.revoked === "boolean",
    );
    return r;
  }
}
