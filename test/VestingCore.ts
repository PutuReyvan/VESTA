import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("VestingManager vesting and claims", function () {
  async function deployFixture() {
    const [admin, beneficiary, other] = await ethers.getSigners();
    const token = await ethers.deployContract("MockERC20");
    const manager = await ethers.deployContract("VestingManager", [
      token.target,
    ]);

    await token.mint(admin.address, ethers.parseEther("10000"));

    return { admin, beneficiary, other, token, manager };
  }

  it("uses an absolute cliff while accruing from start", async function () {
    const { beneficiary, token, manager } = await loadFixture(deployFixture);
    const start = (await time.latest()) + 100;
    const cliff = start + 25;

    await token.approve(manager.target, 1_000n);
    await manager.createBatch(
      token.target,
      [beneficiary.address],
      [1_000n],
      [start],
      [cliff],
      [100],
    );

    await time.increaseTo(cliff - 1);
    expect(await manager.vestedAmount(0)).to.equal(0n);

    await time.increaseTo(cliff);
    expect(await manager.vestedAmount(0)).to.equal(250n);

    await time.increaseTo(start + 50);
    expect(await manager.vestedAmount(0)).to.equal(500n);

    await time.increaseTo(start + 100);
    expect(await manager.vestedAmount(0)).to.equal(1_000n);
  });

  it("uses overflow-safe multiplication for partial vesting", async function () {
    const [admin, beneficiary] = await ethers.getSigners();
    const token = await ethers.deployContract("MockERC20");
    const manager = await ethers.deployContract("VestingManager", [
      token.target,
    ]);
    const start = (await time.latest()) + 100;

    await token.mint(admin.address, ethers.MaxUint256);
    await token.approve(manager.target, ethers.MaxUint256);
    await manager.createBatch(
      token.target,
      [beneficiary.address],
      [ethers.MaxUint256],
      [start],
      [start],
      [100],
    );

    await time.increaseTo(start + 50);
    expect(await manager.vestedAmount(0)).to.equal(
      57_896_044_618_658_097_711_785_492_504_343_953_926_634_992_332_820_282_019_728_792_003_956_564_819_967n,
    );
  });

  it("allows only the beneficiary to claim directly", async function () {
    const { beneficiary, other, token, manager } =
      await loadFixture(deployFixture);
    const start = (await time.latest()) + 100;

    await token.approve(manager.target, 1_000n);
    await manager.createBatch(
      token.target,
      [beneficiary.address],
      [1_000n],
      [start],
      [start],
      [100],
    );

    await time.setNextBlockTimestamp(start + 50);
    const claim = manager.connect(other).getFunction("claim");
    await expect(claim(0)).to.be.revertedWithCustomError(
      manager,
      "Unauthorized",
    );
    expect(await token.balanceOf(other.address)).to.equal(0n);
    expect((await manager.getSchedule(0)).released).to.equal(0n);
  });

  it("tracks partial claims and prevents claiming twice after full vesting", async function () {
    const { beneficiary, token, manager } = await loadFixture(deployFixture);
    const start = (await time.latest()) + 100;
    const cliff = start + 25;

    await token.approve(manager.target, 1_000n);
    await manager.createBatch(
      token.target,
      [beneficiary.address],
      [1_000n],
      [start],
      [cliff],
      [100],
    );
    const claim = manager.connect(beneficiary).getFunction("claim");

    await time.setNextBlockTimestamp(cliff);
    await expect(claim(0))
      .to.emit(manager, "Claimed")
      .withArgs(0n, beneficiary.address, 250n);
    expect(await token.balanceOf(beneficiary.address)).to.equal(250n);
    expect(await manager.claimableAmount(0)).to.equal(0n);

    await time.setNextBlockTimestamp(start + 50);
    await expect(claim(0))
      .to.emit(manager, "Claimed")
      .withArgs(0n, beneficiary.address, 250n);
    expect(await token.balanceOf(beneficiary.address)).to.equal(500n);

    await time.setNextBlockTimestamp(start + 100);
    await expect(claim(0))
      .to.emit(manager, "Claimed")
      .withArgs(0n, beneficiary.address, 500n);

    expect((await manager.getSchedule(0)).released).to.equal(1_000n);
    expect(await token.balanceOf(beneficiary.address)).to.equal(1_000n);
    expect(await token.balanceOf(manager.target)).to.equal(0n);
    await expect(claim(0)).to.be.revertedWithCustomError(
      manager,
      "NothingToClaim",
    );
  });

  it("rejects a claim before the absolute cliff", async function () {
    const { beneficiary, token, manager } = await loadFixture(deployFixture);
    const start = (await time.latest()) + 100;
    const cliff = start + 25;

    await token.approve(manager.target, 1_000n);
    await manager.createBatch(
      token.target,
      [beneficiary.address],
      [1_000n],
      [start],
      [cliff],
      [100],
    );

    await time.setNextBlockTimestamp(cliff - 1);
    const claim = manager.connect(beneficiary).getFunction("claim");
    await expect(claim(0)).to.be.revertedWithCustomError(
      manager,
      "NothingToClaim",
    );
  });
});
