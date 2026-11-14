import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("VestingManager boundary behavior", function () {
  it("accrues at the cliff, midpoint, and exact vesting end", async function () {
    const [admin, beneficiary] = await ethers.getSigners();
    const token = await ethers.deployContract("MockERC20");
    const manager = await ethers.deployContract("VestingManager", [token.target]);
    const allocation = ethers.parseEther("100");
    const start = BigInt((await time.latest()) + 100);
    const cliff = 50n;
    const duration = 100n;

    await token.mint(admin.address, allocation);
    await token.approve(manager.target, allocation);
    await manager.createBatch(
      token.target,
      [beneficiary.address],
      [allocation],
      [start],
      [cliff],
      [duration],
    );

    await time.increaseTo(Number(start - 1n));
    expect(await manager.vestedAmount(1)).to.equal(0n);

    await time.increaseTo(Number(start + cliff));
    expect(await manager.vestedAmount(1)).to.equal(ethers.parseEther("50"));

    await time.increaseTo(Number(start + 75n));
    expect(await manager.vestedAmount(1)).to.equal(ethers.parseEther("75"));

    await time.increaseTo(Number(start + duration));
    expect(await manager.vestedAmount(1)).to.equal(allocation);
  });

  it("updates released accounting and blocks a same-time double claim", async function () {
    const [admin, beneficiary] = await ethers.getSigners();
    const token = await ethers.deployContract("MockERC20");
    const manager = await ethers.deployContract("VestingManager", [token.target]);
    const allocation = ethers.parseEther("100");
    const start = BigInt((await time.latest()) + 100);

    await token.mint(admin.address, allocation);
    await token.approve(manager.target, allocation);
    await manager.createBatch(
      token.target,
      [beneficiary.address],
      [allocation],
      [start],
      [100n],
      [100n],
    );

    await time.increaseTo(Number(start + 100n));
    const balanceBefore = await token.balanceOf(beneficiary.address);
    const claim = manager.connect(beneficiary).getFunction("claim");
    await claim(1);
    expect((await token.balanceOf(beneficiary.address)) - balanceBefore).to.equal(allocation);
    expect((await manager.getSchedule(1)).released).to.equal(allocation);
    await expect(claim(1)).to.be.revertedWithCustomError(manager, "NothingToClaim");
  });
});
