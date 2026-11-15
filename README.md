# VESTA

An ERC-20 vesting project for a five-person university team. The differentiating feature is **Atomic Batch Vesting**: create and fully fund multiple schedules in one all-or-nothing transaction.

## Current status

This repository contains the implemented contract core, Supabase Web3 Auth/RLS boundary, and live Vite frontend flow. The local Sepolia demo has been deployed with a demo ERC-20, seeded `company_admin` role, and the approval → atomic batch → beneficiary claim path. Treat the deployment as an academic testnet instance, not a production deployment.

## MVP scope

- One configured ERC-20 token and one immutable admin.
- Linear vesting from start, with an optional cliff before tokens become available.
- Fully funded atomic batches; any invalid entry or failed funding reverts the entire batch.
- Beneficiary-only claims directly to the recorded beneficiary.
- Wallet login through Supabase Web3 Auth.
- Off-chain recipient metadata and four application roles.
- Wallet-based role assignment: the target wallet must sign in once, then a company admin can assign `hr_operator`, `employee`, or `auditor` without exposing Supabase UUIDs in the UI.
- Admin Overview, Create Batch, and My Vesting screens.

ERC-20 approval is a separate transaction when allowance is insufficient. Atomicity applies to funding and creation inside `createBatch()`. Native currency pays gas only. Schedule fields are immutable after creation. The off-chain database stores identity, roles, and recipient metadata; it never becomes vesting truth. Multi-token support is outside the MVP.

## Setup

Use Node.js 22 and npm 10 or later.

```sh
npm ci
npm run build:all
npm test
npm run lint
npx tsc --noEmit
```

Copy `.env.example` to `.env`. Keep deployer private keys and service-role keys local. Browser variables use the `VITE_` prefix; only the Supabase publishable/anon key belongs in the frontend.

Run the frontend with:

```sh
npm run dev
```

## Repository layout

| Path | Purpose |
| --- | --- |
| `contracts/` | Vesting manager, interface, and local test token |
| `test/` | Contract and off-chain service tests |
| `src/offchain/` | Shared off-chain types and data boundary |
| `src/features/auth/` | Supabase Web3 Auth session and role state |
| `src/features/wallet/` | Wallet connection and Sepolia network state |
| `src/features/vesting/` | Browser provider, ABI, live reads, and transaction helpers |
| `src/pages/` | Frontend screens |
| `supabase/migrations/` | Auth-linked schema and RLS policies |
| `scripts/deploy.ts` | Deploy the manager for a supplied ERC-20 address |

Generated artifacts, dependencies, local planning documents, and agent instructions are not versioned.

## Off-chain and on-chain boundary

Supabase Auth Web3 authenticates the wallet through a Sign-In with Ethereum message. Supabase Database stores `user_roles` and `recipient_profiles`; RLS enforces access by the authenticated Supabase user. The four application roles are `company_admin`, `hr_operator`, `employee`, and `auditor`.

Allocation, released, vested, claimable, beneficiary schedule IDs, and schedule status stay on the contract. Claims execute from the beneficiary wallet and transfer directly to that beneficiary. A relayer must never receive or custody vested tokens.

The first wallet sign-in receives the `Employee` application role automatically and opens the recipient profile form so the user can save a display name. After saving, the editor collapses and the saved name appears in the profile/sidebar and admin member directory. Schedule IDs on the current deployment start at 1. Contract and token addresses are loaded from environment variables and shortened in the UI; they are never embedded as frontend constants.

## Supabase keepalive

`.github/workflows/supabase-keepalive.yml` calls a no-data, anonymous health RPC every 30 minutes. Configure these GitHub repository secrets before enabling it:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (or legacy `SUPABASE_ANON_KEY`)

The workflow never uses the service-role key, reads user data, or writes rows. Scheduled GitHub jobs can be delayed or disabled by GitHub, and this workflow is not a guarantee against provider-level pausing or plan limits.

## Deployer key rotation

If a deployer private key has ever been pasted into chat, committed, or stored in a shared screenshot, treat it as compromised even when it is no longer in the current branch. Create a new Sepolia-only wallet, fund it from a faucet, deploy a new token and manager with that wallet, update the local environment addresses, sign in with the new wallet, and assign it `Company Admin` before removing the old role. Never send the replacement private key to chat or commit it.

## Deployment

Sepolia hosts the smart contracts only. Deploy an approved demo ERC-20 first, then set `VESTA_TOKEN_ADDRESS` and run:

```sh
npm run deploy:token:sepolia
npm run deploy:sepolia
```

Copy the printed token address into `VESTA_TOKEN_ADDRESS` and `VITE_TOKEN_ADDRESS`, then run the manager deployment. Copy its printed address and deployment block into `VESTA_MANAGER_ADDRESS`, `VITE_CONTRACT_ADDRESS`, and `VITE_DEPLOYMENT_BLOCK`; set the same RPC URL as `VESTA_RPC_URL`. Verify both contracts with Hardhat after deployment. The local `MockERC20` is intentionally unsafe and local-only.

## Limitations

This is an unaudited academic project. Sepolia deployment and tests do not replace a formal smart-contract audit. Do not use the contracts with real funds.
