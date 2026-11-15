# VESTA

**VESTA** is a Sepolia demo dApp for managing ERC-20 employee vesting. Its core feature is **Atomic Batch Vesting**: one transaction either creates every schedule in a batch and locks the exact required token amount, or it reverts completely.

**Live demo (Sepolia):** [vesta-gray-five.vercel.app](https://vesta-gray-five.vercel.app/)

## What the app does

An authorized company wallet creates a vesting batch for one or more recipient wallets. Each schedule has an allocation, start time, cliff, and duration. When a recipient's tokens have vested, that recipient claims directly to their own wallet; VESTA never routes vested assets through a relayer.

- **On-chain:** ERC-20 custody, schedules, vesting math, claims, and the manager admin.
- **Off-chain (Supabase):** wallet sign-in, display names, employee references, and application roles.
- **Atomic batch guarantee:** an invalid row, failed allowance, or incorrect token amount rolls back the entire batch.

## How to use VESTA

### 1. Sign in with a wallet

1. Install MetaMask or another injected EVM wallet, select **Ethereum Sepolia**, and keep a small amount of Sepolia ETH for gas.
2. Open the live demo or run the project locally with `npm run dev`.
3. Select **Login with Wallet** and sign the Sign-In with Ethereum message. Signing authenticates the session; it does not spend funds.
4. On the first login, VESTA gives the wallet the **Employee** role and opens the profile form. Save a display name so admins can select the wallet by name later.

### 2. Use the correct screen for your role

| Role | What the user can do |
| --- | --- |
| **Company Admin** | View all schedules, manage off-chain roles, create a batch from the UI, and view personal vesting. |
| **HR Operator** | View the company overview and personal vesting. |
| **Employee** | Manage the recipient profile, see assigned schedules, and claim vested tokens. |
| **Auditor** | View the company overview without batch-creation or role-management access. |

> **Important:** `company_admin` is an off-chain app role. The wallet that submits `createBatch()` must also be the current on-chain `VestingManager.admin()` wallet. The contract enforces this independently of the UI.

### 3. Create and fund an atomic batch (Company Admin)

1. Go to **Create Batch** and add up to 20 recipient rows.
2. For each row, choose or paste the recipient wallet, then enter the allocation, start time, cliff, and duration.
3. Ensure the admin wallet holds enough VESTA. If its allowance is insufficient, select **Approve & Create**; the wallet first approves the manager, then creates the batch.
4. Confirm the transaction(s) in the wallet. After a successful batch, every schedule is stored and the manager holds exactly the total allocation.

### 4. Claim vested tokens (Employee)

1. Sign in with the recipient wallet.
2. Open **My Vesting** to see assigned schedules, vested amount, released amount, and currently claimable amount.
3. Select **Claim** on an unlocked schedule and confirm the transaction. The contract transfers the claimed amount directly to that schedule's recorded recipient wallet.

## Current status

This repository contains the implemented contract core, Supabase Web3 Auth/RLS boundary, and Vite frontend flow. A Sepolia demo uses a demo ERC-20, seeded `company_admin` role, and the approval → atomic batch → beneficiary claim path. Whenever contract source changes, deploy a new manager and update the environment addresses before claiming that the hosted demo matches this commit. Treat every deployment as an academic testnet instance, not a production deployment.

## MVP scope

- One configured ERC-20 token and one transferable on-chain manager admin.
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

## Frontend hosting

The GitHub Pages workflow builds the Vite app from `main`. It reads browser-safe GitHub Actions variables named `VITE_CHAIN_ID`, `VITE_CONTRACT_ADDRESS`, `VITE_TOKEN_ADDRESS`, `VITE_DEPLOYMENT_BLOCK`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. Never store the deployer private key or Supabase service-role key in GitHub Variables or browser-prefixed variables.

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

## On-chain admin rotation

`company_admin` is an off-chain application role; it controls the VESTA UI and role-management RPCs. The manager's on-chain admin separately controls batch creation and excess-token recovery. To revoke that wallet's contract authority, the current on-chain admin must call `transferAdmin(newAdmin)` on `VestingManager`; removing a Supabase role alone is not enough. The contract rejects a zero address, emits `AdminTransferred`, and immediately removes the previous wallet's contract authority.

## Deployment

Sepolia hosts the smart contracts only. Deploy an approved demo ERC-20 first, then set `VESTA_TOKEN_ADDRESS` and run:

```sh
npm run deploy:token:sepolia
npm run deploy:sepolia
```

Copy the printed token address into `VESTA_TOKEN_ADDRESS` and `VITE_TOKEN_ADDRESS`, then run the manager deployment. Copy its printed address and deployment block into `VESTA_MANAGER_ADDRESS`, `VITE_CONTRACT_ADDRESS`, and `VITE_DEPLOYMENT_BLOCK`; set the same RPC URL as `VESTA_RPC_URL`. Verify both contracts with Hardhat after deployment. The local `MockERC20` is intentionally unsafe and local-only.

## Limitations

This is an unaudited academic project. Sepolia deployment and tests do not replace a formal smart-contract audit. Do not use the contracts with real funds.
