# VESTA

An ERC-20 vesting project for a five-person university team. The differentiating feature is **Atomic Batch Vesting**: create and fully fund multiple schedules in one all-or-nothing transaction.

## Current status

This repository contains the contract core, Supabase Web3 Auth data boundary, and Vite frontend foundation. Contract tests and frontend compilation are available. Supabase project configuration, seeded roles, live contract addresses, and end-to-end Sepolia demonstration remain deployment steps.

## MVP scope

- One configured ERC-20 token and one immutable admin.
- Linear vesting from start, with an optional cliff before tokens become available.
- Fully funded atomic batches; any invalid entry or failed funding reverts the entire batch.
- Beneficiary-only claims directly to the recorded beneficiary.
- Wallet login through Supabase Web3 Auth.
- Off-chain recipient metadata and four application roles.
- Admin Overview, Create Batch, and My Vesting screens.

ERC-20 approval is a separate transaction when allowance is insufficient. Atomicity applies to funding and creation inside `createBatch()`. Native currency pays gas only. Schedules can be updated or cancelled only before their start. The off-chain database stores identity, roles, and recipient metadata; it never becomes vesting truth. Multi-token support is outside the MVP.

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
| `src/pages/` | Frontend screens |
| `supabase/migrations/` | Auth-linked schema and RLS policies |
| `scripts/deploy.ts` | Deploy the manager for a supplied ERC-20 address |

Generated artifacts, dependencies, local planning documents, and agent instructions are not versioned.

## Off-chain and on-chain boundary

Supabase Auth Web3 authenticates the wallet through a Sign-In with Ethereum message. Supabase Database stores `user_roles` and `recipient_profiles`; RLS enforces access by the authenticated Supabase user. The four application roles are `company_admin`, `hr_operator`, `employee`, and `auditor`.

Allocation, released, vested, claimable, beneficiary schedule IDs, and schedule status stay on the contract. Claims execute from the beneficiary wallet and transfer directly to that beneficiary. A relayer must never receive or custody vested tokens.

## Deployment

Sepolia hosts the smart contracts only. Deploy an approved demo ERC-20 first, then set `VESTA_TOKEN_ADDRESS` and run:

```sh
npm run deploy:token:sepolia
npm run deploy:sepolia
```

Copy the printed token address into `VESTA_TOKEN_ADDRESS` and `VITE_TOKEN_ADDRESS`, then run the manager deployment. Copy its printed address into `VESTA_MANAGER_ADDRESS` and `VITE_CONTRACT_ADDRESS`; set the same RPC URL as `VESTA_RPC_URL`. Verify both contracts with Hardhat after deployment. The local `MockERC20` is intentionally unsafe and local-only.

## Limitations

This is an unaudited academic project. Sepolia deployment and tests do not replace a formal smart-contract audit. Do not use the contracts with real funds.
