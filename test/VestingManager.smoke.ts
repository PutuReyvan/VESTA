import { expect } from "chai";
import { ethers } from "hardhat";

describe("VestingManager deployment", function () {
  it("stores the configured token and deployer as admin", async function () {
    const [deployer] = await ethers.getSigners();
    const token = await ethers.deployContract("MockERC20");
    const manager = await ethers.deployContract("VestingManager", [
      token.target,
    ]);

    expect(await manager.token()).to.equal(token.target);
    expect(await manager.admin()).to.equal(deployer.address);
    expect(await manager.nextScheduleId()).to.equal(0n);
  });

  it("rejects the zero token address", async function () {
    const factory = await ethers.getContractFactory("VestingManager");

    await expect(factory.deploy(ethers.ZeroAddress))
      .to.be.revertedWithCustomError(factory, "InvalidToken")
      .withArgs(ethers.ZeroAddress);
  });

  it("rejects a token address without contract code", async function () {
    const [, account] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("VestingManager");

    await expect(factory.deploy(account.address))
      .to.be.revertedWithCustomError(factory, "InvalidToken")
      .withArgs(account.address);
  });
});
