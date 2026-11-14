import { expect } from "chai";
import { ethers } from "hardhat";

describe("VestingManager foundation", function () {
  // This test protects the deployment seam. It does not test vesting behavior.
  it("stores the configured token and deployer as admin", async function () {
    const [deployer] = await ethers.getSigners();
    const token = await ethers.deployContract("MockERC20");
    const manager = await ethers.deployContract("VestingManager", [token.target]);

    expect(await manager.token()).to.equal(token.target);
    expect(await manager.admin()).to.equal(deployer.address);
    expect(await manager.nextScheduleId()).to.equal(0n);
  });

  it("rejects an empty batch", async function () {
    const token = await ethers.deployContract("MockERC20");
    const manager = await ethers.deployContract("VestingManager", [token.target]);

    await expect(
      manager.createBatch(token.target, [], [], [], [], [])
    ).to.be.revertedWithCustomError(manager, "EmptyBatch");
  });
});
