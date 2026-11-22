# Zenvor Developer API

JavaScript and TypeScript tools for integrating Zenvor transfers on chain **4663**.

- [SDK documentation](sdk/README.md) — typed backend API client, wallet helpers, and registration client.
- [Integration guide](docs/integration.md) — key registration, transaction lifecycle, fees, and reconciliation.
- [OpenAPI specification](openapi/zenvor.json) — HTTP endpoints and schemas.
- [Backend example](sdk/examples/backend.mjs) — inspect supported features and assets.
- [Developer portal](https://znvr.app/developers/) · [Hosted documentation](https://znvr.app/docs/)

## Install

Use Node.js 22 or newer:

```sh
npm install @zenvorprotocol/sdk
```

```js
import { ZenvorClient } from '@zenvorprotocol/sdk';

const api = new ZenvorClient({ apiKey: process.env.ZENVOR_API_KEY });
const features = await api.features();
```

The default API endpoint is `https://znvr.app/api`. Keep API keys on your backend. Wallet helpers are available separately at `@zenvorprotocol/sdk/wallet`; the authenticated client is blocked in browser imports.

## Get an API key

Open the [developer portal](https://znvr.app/developers/), connect your wallet, and sign the registration message. Registration is free and off-chain. The key is displayed once; store it securely on your backend. Rotation and revocation require a new wallet signature.

## Transfers and fees

The API supports ETH and USDG transfers through Abstraction, Reactive Mesh, and Multi-send; listed RWA baskets; and single-recipient Abstraction for supported imported ERC-20 tokens. Query `features()` before enabling an integration.

Each successful API execution includes a **0.00001 ETH** fee in the same transaction as the requested transfer. Gas is additional. Recipient payouts are net amounts, and prepared requests already include the fee. If execution reverts, the payouts and execution fee revert together; network gas can still be charged. Registration, quotes, simulations, and token approvals carry no API execution fee.

The API prepares unsigned requests. The wallet owner reviews, signs, and broadcasts them. See the [integration guide](docs/integration.md) for approvals, tracking, and retry handling.

## Develop

```sh
cd sdk
npm ci
npm test
npm run check:public
```

The SDK has no runtime dependencies. Its build generates ESM, CommonJS, and TypeScript declarations in `sdk/dist/`.

## Security and license

Read [SECURITY.md](SECURITY.md) before integrating. Licensed under the [MIT License](LICENSE).
