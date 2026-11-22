import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "zenvor-sdk-package-"));
const run = (command, args, cwd = temporary) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
try {
  // The caller builds/tests first. Avoid recursive lifecycle execution in the artifact check.
  const [pack] = JSON.parse(
    run(
      "npm",
      ["pack", "--ignore-scripts", "--json", "--pack-destination", temporary],
      root,
    ),
  );
  const modules = [
    "browser",
    "errors",
    "registration",
    "server",
    "transport",
    "types",
    "validate",
    "wallet",
  ];
  const expected = new Set([
    "package.json",
    "README.md",
    "SECURITY.md",
    "CHANGELOG.md",
    "LICENSE",
    "dist/cjs/package.json",
  ]);
  for (const format of ["esm", "cjs"])
    for (const module of modules)
      for (const extension of ["js", "d.ts"])
        expected.add(`dist/${format}/${module}.${extension}`);
  assert.deepEqual(
    pack.files.map((file) => file.path).sort(),
    [...expected].sort(),
    "Unexpected package contents",
  );
  assert.deepEqual(pack.bundled, []);
  fs.writeFileSync(
    path.join(temporary, "package.json"),
    JSON.stringify({
      name: "zenvor-consumer-smoke",
      private: true,
      type: "module",
    }),
  );
  run("npm", [
    "install",
    "--offline",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--package-lock=false",
    path.join(temporary, pack.filename),
  ]);
  const installed = path.join(
    temporary,
    "node_modules",
    ...manifest.name.split("/"),
  );
  const published = JSON.parse(
    fs.readFileSync(path.join(installed, "package.json"), "utf8"),
  );
  assert.equal(published.name, manifest.name);
  assert.equal(published.version, manifest.version);
  assert.equal(published.license, "MIT");
  assert.equal(published.private, false);
  assert.deepEqual(Object.keys(published.exports), [
    ".",
    "./wallet",
    "./registration",
  ]);
  assert.equal(Object.keys(published.dependencies || {}).length, 0);
  assert.ok(
    fs
      .readFileSync(path.join(installed, "LICENSE"), "utf8")
      .includes("Copyright (c) 2026 Zenvor contributors"),
  );
  for (const format of ["esm", "cjs"])
    assert.equal(
      fs.existsSync(path.join(installed, "dist", format, "payments.js")),
      false,
    );

  const moduleName = JSON.stringify(manifest.name);
  const smoke = `
const assert = await import('node:assert/strict');
const { ZenvorClient } = await import(${moduleName});
const { RegistrationClient } = await import(${JSON.stringify(manifest.name + "/registration")});
const wallet = await import(${JSON.stringify(manifest.name + "/wallet")});
assert.equal(typeof wallet.sendReviewedTransaction, 'function');
assert.equal(typeof wallet.sendTrackedTransaction, 'function');
let target, auth;
const api = new ZenvorClient({ apiKey: 'clean-consumer-test-key-without-live-access', fetch: async (url, init) => {
 target = url; auth = init.headers.Authorization;
 return Response.json({ chainId:4663, methods:['abstraction'], serverSigns:false, serverBroadcasts:false });
}});
await api.features();
assert.equal(target, 'https://znvr.app/api/v1/features');
assert.ok(auth.startsWith('Bearer '));
const recipient = '0x' + '1'.repeat(40);
const registration = new RegistrationClient({ fetch: async (url, init) => {
 target = url; auth = init.headers.Authorization;
 return Response.json({ mode:'offchain', chainId:4663, address:null, codeHash:null, request:null, feeWei:'0', feeEth:'0', receiver:recipient, confirmations:0, requesterKey:null, hasApiKey:false, executionFee:{wei:'10000000000000',asset:'ETH',recipient} });
}});
await registration.config();
assert.equal(target, 'https://znvr.app/api/registration/config');
assert.equal(auth, undefined);
await assert.rejects(() => import(${JSON.stringify(manifest.name + "/payments")}), {code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
`;
  fs.writeFileSync(path.join(temporary, "smoke.mjs"), smoke);
  run(process.execPath, ["smoke.mjs"]);
  const commonJs = `
const assert = require('node:assert/strict');
const { ZenvorClient } = require(${moduleName});
assert.equal(typeof ZenvorClient, 'function');
assert.equal(typeof require(${JSON.stringify(manifest.name + "/registration")}).RegistrationClient, 'function');
assert.equal(typeof require(${JSON.stringify(manifest.name + "/wallet")}).sendReviewedTransaction, 'function');
assert.throws(() => require(${JSON.stringify(manifest.name + "/payments")}), {code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
`;
  fs.writeFileSync(path.join(temporary, "smoke.cjs"), commonJs);
  run(process.execPath, ["smoke.cjs"]);
  for (const format of ["mjs", "cjs"]) {
    const loading =
      format === "mjs"
        ? `import { ZenvorClient } from ${moduleName}; import assert from 'node:assert/strict';`
        : `const { ZenvorClient } = require(${moduleName}); const assert = require('node:assert/strict');`;
    fs.writeFileSync(
      path.join(temporary, `browser.${format}`),
      `${loading}\nassert.throws(() => new ZenvorClient({apiKey:'must-never-leave-browser'}), {code:'SERVER_ONLY'});\n`,
    );
    run(process.execPath, ["--conditions=browser", `browser.${format}`]);
  }
  const types = `
import { ZenvorClient, type RegistrationConfig, type QuoteInput } from ${moduleName};
import { RegistrationClient } from ${JSON.stringify(manifest.name + "/registration")};
import { sendReviewedTransaction, sendTrackedTransaction } from ${JSON.stringify(manifest.name + "/wallet")};
const api = new ZenvorClient({apiKey:'types-only-no-network'});
const registration = new RegistrationClient();
const quote: QuoteInput = {method:'abstraction',sender:'0x1234',recipient:'0x1234',amount:'1'};
async function check() {
 const policy: RegistrationConfig = await registration.config();
 const mode: 'offchain' = policy.mode;
 const request: null = policy.request;
 await api.quote(quote);
 void mode; void request;
}
void check; void sendReviewedTransaction; void sendTrackedTransaction;
`;
  for (const extension of ["mts", "cts"])
    fs.writeFileSync(path.join(temporary, `types.${extension}`), types);
  run(process.execPath, [
    path.join(root, "node_modules/typescript/bin/tsc"),
    "--noEmit",
    "--strict",
    "--target",
    "ES2022",
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    "--lib",
    "ES2022,DOM",
    "types.mts",
    "types.cts",
  ]);
  console.log(
    JSON.stringify(
      {
        package: pack.id,
        files: pack.files.length,
        packedBytes: pack.size,
        unpackedBytes: pack.unpackedSize,
        integrity: pack.integrity,
        checks: [
          "exact allowlist",
          "offline clean install",
          "ESM",
          "CommonJS",
          "ESM/CJS browser credential guard",
          "NodeNext .mts/.cts declarations",
          "production defaults",
          "registration without bearer",
          "merchant excluded",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  fs.rmSync(temporary, { recursive: true });
}
