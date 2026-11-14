import { expect } from "chai";
import { ethers } from "hardhat";

describe("VestingManager vesting core", function () {
  it("blocks claims from a wallet other than the beneficiary", async function () {
    const [admin, beneficiary, other] = await ethers.getSigners();
    const token = await ethers.deployContract("MockERC20");
    const manager = await ethers.deployContract("VestingManager", [
      token.target,
    ]);

    const latest = await ethers.provider.getBlock("latest");
    const start = BigInt(latest!.timestamp + 10);
    const amount = ethers.parseEther("100");

    await token.mint(admin.address, amount);
    await token.approve(manager.target, amount);

    await manager.createBatch(
      token.target,
      [beneficiary.address],
      [amount],
      [start],
      [0],
      [100],
    );

    const claim = manager.connect(other).getFunction("claim");
    await expect(
      claim(0),
    ).to.be.revertedWithCustomError(manager, "Unauthorized");
  });

  it("does not allow a claim before the cliff", async function () {
    const [admin, beneficiary] = await ethers.getSigners();
    const token = await ethers.deployContract("MockERC20");
    const manager = await ethers.deployContract("VestingManager", [
      token.target,
    ]);

    const latest = await ethers.provider.getBlock("latest");
    const start = BigInt(latest!.timestamp + 10);
    const amount = ethers.parseEther("100");

    await token.mint(admin.address, amount);
    await token.approve(manager.target, amount);

    await manager.createBatch(
      token.target,
      [beneficiary.address],
      [amount],
      [start],
      [50],
      [100],
    );

    const claim = manager.connect(beneficiary).getFunction("claim");
    await expect(
      claim(0),
    ).to.be.revertedWithCustomError(manager, "NothingToClaim");
  });
});
