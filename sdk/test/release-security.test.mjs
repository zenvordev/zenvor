import { test } from "node:test";
import assert from "node:assert/strict";
import { ZenvorClient } from "../dist/esm/server.js";
import { sendReviewedTransaction } from "../dist/esm/wallet.js";
const key = "SDK_TEST_SECRET_DO_NOT_REFLECT_THIS_VALUE";
test("unrecognized server error codes cannot reflect credentials", async () => {
  const api = new ZenvorClient({
    apiKey: key,
    fetch: async () =>
      Response.json({ error: { code: key, message: key } }, { status: 400 }),
  });
  await assert.rejects(
    api.features(),
    (e) => e.code === "API_ERROR" && !JSON.stringify(e).includes(key),
  );
});
test("wallet exceptions redact provider request details", async () => {
  const request = {
    from: "0x" + "1".repeat(40),
    chainId: "0x1237",
    data: "0x1234",
    value: "0x1",
    nonce: "0x0",
    gas: "0x5208",
  };
  const provider = {
    request: async () => {
      throw new Error(key);
    },
  };
  await assert.rejects(
    sendReviewedTransaction(provider, request, {
      account: request.from,
      kind: "execution",
      valueWei: "1",
      data: request.data,
      nonce: request.nonce,
    }),
    (e) => e.code === "WALLET_ERROR" && !String(e).includes(key) && !e.cause,
  );
});

test("production API is the default and local HTTP requires an explicit loopback opt-in", async () => {
  const seen = [];
  const fetch = async (url) => {
    seen.push(url);
    return Response.json({
      chainId: 4663,
      methods: ["abstraction"],
      serverSigns: false,
      serverBroadcasts: false,
    });
  };
  await new ZenvorClient({ apiKey: key, fetch }).features();
  assert.equal(seen.pop(), "https://znvr.app/api/v1/features");
  for (const baseUrl of [
    "http://127.0.0.1:3100",
    "http://localhost:3100",
    "http://[::1]:3100",
  ]) {
    assert.throws(() => new ZenvorClient({ apiKey: key, baseUrl, fetch }), {
      code: "INVALID_INPUT",
    });
    await new ZenvorClient({
      apiKey: key,
      baseUrl,
      allowInsecureLocalhost: true,
      fetch,
    }).features();
    assert.equal(seen.pop(), baseUrl + "/v1/features");
  }
  for (const baseUrl of [
    "",
    "http://example.com",
    "https://user:secret@example.com",
    "https://example.com?key=secret",
  ]) {
    assert.throws(
      () =>
        new ZenvorClient({
          apiKey: key,
          baseUrl,
          allowInsecureLocalhost: true,
          fetch,
        }),
      { code: "INVALID_INPUT" },
    );
  }
});
