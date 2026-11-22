# Integrate the Zenvor API

Production API base: `https://znvr.app/api` · Chain ID: **4663**

Use the [OpenAPI specification](../openapi/zenvor.json) for HTTP schemas and the [SDK reference](../sdk/README.md) for typed examples.

## Register and manage access

The [developer portal](https://znvr.app/developers/) issues a key after an explicit wallet signature. Registration requires no contract transaction, registration payment, or gas. One wallet has one active key and a stable developer identity. The raw API key appears once. Save it in your backend's secret store and clear transient client state.

The registration protocol uses `/registration/config`, `/registration/challenge`, `/registration/authenticate`, and `/registration/key`. Each challenge binds the exact message to the wallet, official origin, chain scope, and requested action (`issue`, `rotate`, or `revoke`). Sign the returned message exactly. A session authorizes one action; do not automatically retry issuance, rotation, or revocation after a transport failure. Refresh key status and reconcile first.

Rotation invalidates the previous key. Revocation disables the current key. The wallet's stable developer identity preserves existing transaction attribution across rotation. Registration POSTs are limited to 10 requests per minute per IP; browser registration requests must originate from the official portal.

Authenticate `/v1/*` requests with `Authorization: Bearer <API_KEY>`. Keep this credential on your backend. Do not put it in a browser bundle, public environment variable, local storage, analytics, or logs. The SDK's `@zenvorprotocol/sdk/registration` entry point handles the registration protocol; `@zenvorprotocol/sdk` is the backend transfer client.

## Execute a transfer

1. Query `features()` and `assets()` to confirm the requested method and asset are supported.
2. Create a quote with exact decimal strings, the sender, and recipient allocations. A quote is valid for 60 minutes.
3. For token transfers, request each approval in order. Review the token, spender, and exact amount; ask the wallet owner to confirm it, wait for a successful receipt, then check again until approvals are complete. ETH transfers need no token approval.
4. Simulate the approved quote. A simulation is valid for 60 seconds. Show the resulting payouts, value, execution fee, and gas estimate to the wallet owner.
5. After explicit execution confirmation, prepare the transaction. Preparation repeats the live preflight. Save the returned tracking token on your backend.
6. Validate the prepared request against the independently reviewed sender, chain, value, calldata, and nonce. The wallet owner signs and broadcasts it. A transfer execution is a contract-creation request; do not add a destination address.
7. Submit the transaction hash and tracking token to `status()` or `track()` from the same developer account. Report success only after the API confirms the matching canonical transaction and settlement.

Changed inputs, nonce changes, and unrelated wallet transactions can invalidate a quote or approval plan. Quotes and tracking tokens belong to the authenticated developer account; bind them to the correct user session in your application.

## Fees and approvals

The API execution fee is **0.00001 ETH**, plus network gas. ETH transaction value includes the net transfer and execution fee. Token transaction value includes the ETH fee while token recipients receive their quoted net amounts. Prepared requests already include the fee; do not add it twice. On execution failure the payouts and fee revert atomically, while network gas may still be charged.

Token approvals are separate transactions with network gas costs and no API execution fee. An existing approval can remain after a later execution fails. Reconcile state before preparing a replacement; do not submit unlimited approvals or send approval transactions concurrently.

## Tracking and recovery

Save the transaction hash immediately after wallet submission. A transport timeout does not prove that a transaction was not broadcast. Reconcile its receipt and API status before asking for another signature. Wallet submissions and state-changing registration requests are not automatically retried.

`track()` registers the exact submitted hash for durable backend reconciliation. Tracking is isolated by the developer identity and survives a key rotation for the same wallet. Preserve opaque tracking tokens on your backend and redact them from logs. Two L2 confirmations used by settlement checks do not imply L1 finality.

Your application remains responsible for authenticating its users, verifying ownership of the sending wallet, validating unsigned requests, protecting state-changing backend routes, and clearly presenting wallet confirmations. See [security boundaries](../SECURITY.md).

## Local development

The SDK defaults to the production endpoint. To connect to a locally operated compatible API, explicitly set a loopback URL and `allowInsecureLocalhost: true`. Other custom endpoints require HTTPS. A clean SDK checkout needs Node.js 22 or newer and `npm ci` inside `sdk/`; it does not require the website or a running API for its unit tests.
