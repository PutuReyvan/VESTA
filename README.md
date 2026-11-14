# VESTA

An ERC-20 vesting project for a five-person university team. The planned differentiating feature is **Atomic Batch Vesting**: create and fully fund multiple schedules in one all-or-nothing transaction.

## Current status

This repository implements the contract core and server-side off-chain service: ERC-20 atomic batch creation, vesting/cliff calculations, beneficiary claims, local tests, wallet-signature authentication, role checks, and Supabase migrations. A browser UI, HTTP API, Supabase deployment, and Sepolia rehearsal are still pending.

## MVP scope

- One configured ERC-20 token and one immutable admin.
- Linear vesting from start, with an optional cliff before tokens become available.
- Fully funded atomic batches; any invalid entry or failed funding reverts the entire batch.
- Beneficiary-only claims directly to the recorded beneficiary.
- Admin Overview, Create Batch, and My Vesting screens.
- Local tests followed by a Sepolia demonstration.

ERC-20 approval is a separate transaction when allowance is insufficient. Atomicity applies to funding and creation inside `createBatch()`. Native currency pays gas only. Schedules can be updated or cancelled only before their start. The off-chain database stores authentication, roles, and recipient metadata; it never becomes the vesting source of truth. Multi-token support is outside the MVP.

## Setup

Use Node.js 22 and npm 10 or later. The foundation uses Hardhat, TypeScript, Solidity 0.8.24, ethers 6, and OpenZeppelin Contracts 5.

```sh
npm ci
npm run build
npm test
npm run lint
npx tsc --noEmit
```

An environment file is unnecessary for compilation and local tests. For deployment, copy `.env.example` to `.env` and fill in the required values. Leave unused values empty. Never commit private keys or a populated environment file.

## Repository layout

| Path | Purpose |
| --- | --- |
| `contracts/interfaces/IVestingManager.sol` | Shared schedule shape and function signatures |
| `contracts/VestingManager.sol` | Atomic batch lifecycle, vesting math, and direct beneficiary claims |
| `contracts/test/MockERC20.sol` | Mintable local test fixture |
| `test/` | Contract and off-chain authorization tests |
| `scripts/deploy.ts` | Deploy the manager for a supplied token address |
| `src/offchain/` | Server-side wallet authentication, role guards, metadata, and contract reads |
| `supabase/migrations/` | Off-chain data schema and row-level-security policies |

Generated artifacts, dependencies, local planning documents, and agent instructions are not versioned.

## Off-chain authentication and data boundary

The Supabase migration at [`supabase/migrations/001_offchain_auth.sql`](supabase/migrations/001_offchain_auth.sql) creates:

- `recipient_profiles` for CRUD metadata only (display name, employee reference, and application metadata).
- `user_roles` for wallet-to-role mappings: `company_admin`, `hr_operator`, `employee`, and `auditor`.
- `auth_nonces` for short-lived, one-time wallet sign-in challenges.

`src/offchain/` provides the framework-independent service surface for the frontend/API team. `WalletAuthService` creates a nonce challenge, verifies the wallet signature, consumes the nonce, loads current roles, and issues an HMAC-signed session. `OffchainService` exposes profile and role operations, including role-guarded profile reads. Apply RLS policies and use the Supabase service-role key only on a trusted server; never ship it to a browser.

The contract boundary is intentional: allocation, released, vested, claimable, beneficiary schedule IDs, and schedule status are never stored in Postgres. `ContractDataService` reads those values from `VestingManager` using the configured RPC URL and manager address. Database rows can describe a recipient and authorize an application action, but they cannot be used as token balances or vesting truth. A UI should combine `OffchainService` profile/role results with `ContractDataService` reads and should submit claims/transactions through the wallet.

## Contract flow

The admin flow is `token.approve(manager, total)` when needed, followed by `manager.createBatch(...)`. The beneficiary flow reads schedules and available amounts, then calls `manager.claim(scheduleId)` from the beneficiary's own wallet. The contract transfers assets directly to that recorded beneficiary; a relayer must never receive or custody the vested tokens.

`token()`, `admin()`, and `nextScheduleId()` expose contract configuration. Local tests cover the implemented contract and off-chain authorization paths, but they do not replace a formal external audit.

## Local deployment

Start the local chain in one terminal:

```sh
npx hardhat node
```

Deploy a local token using the Hardhat console in another terminal:

```sh
npx hardhat console --network localhost
```

```js
const token = await ethers.deployContract("MockERC20");
await token.waitForDeployment();
console.log(await token.getAddress());
```

Exit the console, set `VESTA_TOKEN_ADDRESS` in `.env` to that local token address, then run `npm run deploy:local`. Restarting the local chain requires redeploying both contracts and updating the address.

For a later Sepolia rehearsal, set `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, and `VESTA_TOKEN_ADDRESS` for that network, then run `npm run deploy:sepolia`. The script deploys only the manager; it does not deploy or fund the token. Validate the token address and network before deployment.

## Team responsibilities

| Area | Contribution |
| --- | --- |
| Foundation & Integration | Shared interfaces, scaffolding, tooling, integration, and handoffs |
| Vesting Core | Storage, vesting/cliff calculations, claims, and unit tests |
| Atomic Batch | Validation, funding, creation events, rollback, and gas measurements |
| Frontend & Demo | Wallet connection, admin/beneficiary screens, and transaction feedback |
| Testing & Security | Adversarial tests, invariants, deployment checks, and demo evidence |

These are peer responsibilities. Each contributor owns implementation and tests in their area; shared changes are coordinated with affected contributors.

## Limitations

This is an unaudited academic foundation and must not be used with real funds. Only a selected standard, non-rebasing, non-fee-on-transfer demo token is in scope. Gas savings and security properties require feature implementation and measurement; neither is established by the smoke tests.
