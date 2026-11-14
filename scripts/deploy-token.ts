// Deploys the restricted-mint demo ERC-20 for Sepolia.
// Usage: npm run deploy:token:sepolia
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const token = await ethers.deployContract("VestaDemoToken");
  await token.waitForDeployment();

  const mintAmount = process.env.DEMO_TOKEN_MINT_AMOUNT ?? "1000000";
  const mintTx = await token.mint(
    deployer.address,
    ethers.parseUnits(mintAmount, 18)
  );
  await mintTx.wait();

  console.log(`VestaDemoToken deployed at ${token.target}`);
  console.log(`Owner/deployer: ${deployer.address}`);
  console.log(`Minted ${mintAmount} VESTA to owner`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
