# VESTA

An ERC-20 vesting project for a five-person university team. The planned differentiating feature is **Atomic Batch Vesting**: create and fully fund multiple schedules in one all-or-nothing transaction.

## Current status

The core DApp path is implemented: the contract creates exactly funded atomic batches, calculates linear vesting with an absolute cliff timestamp, and sends claims directly to the recorded beneficiary. The React frontend reads live contract state and submits approval, batch creation, and claim transactions through an injected wallet.

The current access model has two on-chain identities: the immutable admin and each schedule beneficiary. Four-role authorization and off-chain CRUD are not implemented in this core branch.

## MVP scope

- One configured ERC-20 token and one immutable admin.
- Linear vesting from start, with an optional cliff before tokens become available.
- Fully funded atomic batches; any invalid entry or failed funding reverts the entire batch.
- Beneficiary-only claims directly to the recorded beneficiary.
- Admin Overview, Create Batch, and My Vesting screens.
- Local tests followed by a Sepolia demonstration.

ERC-20 approval is a separate transaction when allowance is insufficient. Atomicity applies to funding and creation inside `createBatch()`. Native currency pays gas only. Relayers, delegated claims, cancellation, multi-token support, and a backend database are outside the MVP.

## Setup

Use Node.js 22 and npm 10 or later. The project uses Hardhat, TypeScript, Solidity 0.8.24, ethers 6, React, and OpenZeppelin Contracts 5.

```sh
npm ci
npm run build
npm test
npm run lint
npx tsc --noEmit

cd frontend
npm ci
npm run build
npm run lint
```

An environment file is unnecessary for compilation and local tests. For deployment, copy `.env.example` to `.env` and fill in the required values. Leave unused values empty. Never commit private keys or a populated environment file.

## Repository layout

| Path | Purpose |
| --- | --- |
| `contracts/interfaces/IVestingManager.sol` | Shared schedule shape and function signatures |
| `contracts/VestingManager.sol` | Atomic batch creation, vesting math, and direct claims |
| `contracts/test/MockERC20.sol` | Mintable local test fixture |
| `test/` | Deployment, rollback, vesting, and claim acceptance tests |
| `scripts/deploy.ts` | Deploy the manager for a supplied token address |
| `frontend/src/features/vesting/` | Ethers adapter for all contract reads and writes |
| `frontend/src/pages/` | Admin overview, batch creation, and beneficiary vesting screens |

Generated artifacts, dependencies, local planning documents, and agent instructions are not versioned.

## Contract flow

The admin flow is `token.approve(manager, total)` when allowance is insufficient, followed by `manager.createBatch(...)`. Approval is a separate ERC-20 transaction; atomicity applies to validation, funding, and schedule creation inside `createBatch()`.

The beneficiary flow reads schedule IDs and claimable amounts, then calls `manager.claim(scheduleId)`. The contract always transfers claimed assets to the recorded beneficiary. A relayer or different wallet cannot redirect the payout.

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

To run the frontend, copy `frontend/.env.example` to `frontend/.env`, set `VITE_CHAIN_ID` and `VITE_VESTA_CONTRACT_ADDRESS`, then run `npm run dev` inside `frontend/`. The connected wallet must use the configured chain.

For a Sepolia rehearsal, set `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, and `VESTA_TOKEN_ADDRESS` for that network, then run `npm run deploy:sepolia`. The script deploys only the manager; it does not deploy or fund the token. Validate the token address and network before deployment.

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

This is unaudited academic software and must not be used with real funds. Only a selected standard, non-rebasing, non-fee-on-transfer demo token is in scope. The tests cover the core invariants, but maximum-batch gas evidence, a live Sepolia rehearsal, frontend transaction tests, four-role authorization, and off-chain CRUD still require separate evidence before assignment submission.
