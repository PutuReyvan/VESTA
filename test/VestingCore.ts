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
      claim(1),
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
      claim(1),
    ).to.be.revertedWithCustomError(manager, "NothingToClaim");
  });

  it("rolls back a claim when a token underpays the beneficiary", async function () {
    const [admin, beneficiary] = await ethers.getSigners();
    const token = await ethers.deployContract("ClaimFeeToken", [admin.address]);
    const manager = await ethers.deployContract("VestingManager", [token.target]);
    const amount = ethers.parseEther("100");
    const start = BigInt((await ethers.provider.getBlock("latest"))!.timestamp + 10);

    await token.mint(admin.address, amount);
    await token.approve(manager.target, amount);
    await manager.createBatch(
      token.target,
      [beneficiary.address],
      [amount],
      [start],
      [0],
      [10],
    );

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(start + 10n)]);
    await ethers.provider.send("evm_mine", []);
    const claim = manager.connect(beneficiary).getFunction("claim");
    await expect(claim(1))
      .to.be.revertedWithCustomError(manager, "InvalidClaimTransfer")
      .withArgs(amount, ethers.parseEther("99"));
    expect((await manager.getSchedule(1)).released).to.equal(0n);
    expect(await token.balanceOf(manager.target)).to.equal(amount);
  });
});
