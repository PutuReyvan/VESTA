// Deploys the already-selected ERC-20 and prints the manager address for the frontend.
// Usage: VESTA_TOKEN_ADDRESS=0x... npm run deploy:sepolia
import { ethers } from "hardhat";

async function main() {
  const tokenAddress = process.env.VESTA_TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error("VESTA_TOKEN_ADDRESS is required");
  }

  // The manager does not deploy the token. The same configured token is used for
  // approval, batch funding, schedule reads, and beneficiary claims.
  const manager = await ethers.deployContract("VestingManager", [tokenAddress]);
  await manager.waitForDeployment();

  console.log(`VestingManager deployed at ${manager.target}`);
  console.log(`Configured token: ${tokenAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
