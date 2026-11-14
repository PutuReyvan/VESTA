import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("VestingManager security regressions", function () {
  async function deployFixture() {
    const [admin, beneficiary, other] = await ethers.getSigners();
    const token = await ethers.deployContract("MockERC20");
    const otherToken = await ethers.deployContract("MockERC20");
    const manager = await ethers.deployContract("VestingManager", [token.target]);
    const allocation = ethers.parseEther("10");
    const start = BigInt((await time.latest()) + 100);

    await token.mint(admin.address, ethers.parseEther("1000"));
    await token.approve(manager.target, ethers.MaxUint256);

    return {
      admin,
      beneficiary,
      other,
      token,
      otherToken,
      manager,
      allocation,
      start,
    };
  }

  it("rejects batch creation by a non-admin wallet", async function () {
    const { beneficiary, other, token, manager, allocation, start } =
      await loadFixture(deployFixture);

    await expect(
      manager.connect(other).createBatch(
        token.target,
        [beneficiary.address],
        [allocation],
        [start],
        [0],
        [86400],
      ),
    ).to.be.revertedWithCustomError(manager, "Unauthorized");
  });

  it("rejects funding with a token other than the configured token", async function () {
    const { beneficiary, otherToken, manager, allocation, start } =
      await loadFixture(deployFixture);

    await expect(
      manager.createBatch(
        otherToken.target,
        [beneficiary.address],
        [allocation],
        [start],
        [0],
        [86400],
      ),
    )
      .to.be.revertedWithCustomError(manager, "InvalidToken")
      .withArgs(otherToken.target, await manager.token());
  });

  it("accepts exactly twenty rows and emits a reconstructable range", async function () {
    const { beneficiary, token, manager, allocation, start } =
      await loadFixture(deployFixture);
    const count = 20;

    await expect(
      manager.createBatch(
        token.target,
        Array.from({ length: count }, () => beneficiary.address),
        Array.from({ length: count }, () => allocation),
        Array.from({ length: count }, () => start),
        Array.from({ length: count }, () => 0),
        Array.from({ length: count }, () => 86400),
      ),
    )
      .to.emit(manager, "BatchCreated")
      .withArgs((await ethers.getSigners())[0].address, 1, count, allocation * 20n);

    expect(await manager.nextScheduleId()).to.equal(21n);
    expect(await manager.getBeneficiarySchedules(beneficiary.address)).to.deep.equal(
      Array.from({ length: count }, (_, index) => BigInt(index + 1)),
    );
  });

  for (const invalidIndex of [0, 1, 2]) {
    it(`rolls back the entire batch when row ${invalidIndex + 1} is invalid`, async function () {
      const { beneficiary, token, manager, allocation, start } =
        await loadFixture(deployFixture);
      const beneficiaries = Array.from(
        { length: 3 },
        () => beneficiary.address,
      );
      beneficiaries[invalidIndex] = ethers.ZeroAddress;

      await expect(
        manager.createBatch(
          token.target,
          beneficiaries,
          [allocation, allocation, allocation],
          [start, start, start],
          [0, 0, 0],
          [86400, 86400, 86400],
        ),
      ).to.be.revertedWithCustomError(manager, "InvalidBeneficiary");

      expect(await manager.nextScheduleId()).to.equal(1n);
      expect(await manager.getBeneficiarySchedules(beneficiary.address)).to.deep.equal(
        [],
      );
      expect(await token.balanceOf(manager.target)).to.equal(0n);
    });
  }

  it("rejects a schedule whose end timestamp exceeds uint64", async function () {
    const { beneficiary, token, manager, allocation } =
      await loadFixture(deployFixture);
    const uint64Max = (1n << 64n) - 1n;

    await expect(
      manager.createBatch(
        token.target,
        [beneficiary.address],
        [allocation],
        [uint64Max],
        [0],
        [1],
      ),
    ).to.be.revertedWithCustomError(manager, "InvalidScheduleTerms");
  });

  it("rejects a zero allocation without storing a schedule", async function () {
    const { beneficiary, token, manager, start } =
      await loadFixture(deployFixture);

    await expect(
      manager.createBatch(
        token.target,
        [beneficiary.address],
        [0],
        [start],
        [0],
        [86400],
      ),
    ).to.be.revertedWithCustomError(manager, "InvalidAllocation");

    expect(await manager.nextScheduleId()).to.equal(1n);
  });

  it("rolls back every row when total allocation overflows", async function () {
    const { beneficiary, token, manager, start } =
      await loadFixture(deployFixture);

    await expect(
      manager.createBatch(
        token.target,
        [beneficiary.address, beneficiary.address],
        [ethers.MaxUint256, 1],
        [start, start],
        [0, 0],
        [86400, 86400],
      ),
    ).to.be.revertedWithPanic(0x11);

    expect(await manager.nextScheduleId()).to.equal(1n);
    expect(await manager.getBeneficiarySchedules(beneficiary.address)).to.deep.equal(
      [],
    );
  });

  it("blocks a malicious token from re-entering claim", async function () {
    const [admin, beneficiary] = await ethers.getSigners();
    const token = await ethers.deployContract("ReentrantClaimToken");
    const manager = await ethers.deployContract("VestingManager", [token.target]);
    const allocation = ethers.parseEther("10");
    const start = BigInt((await time.latest()) + 10);

    await token.configure(manager.target, 1);
    await token.mint(admin.address, allocation);
    await token.approve(manager.target, allocation);
    await manager.createBatch(
      token.target,
      [beneficiary.address],
      [allocation],
      [start],
      [0],
      [10],
    );
    await token.enableAttack();
    await time.increaseTo(Number(start + 10n));

    await manager.connect(beneficiary).claim(1);

    expect(await token.reentrySucceeded()).to.equal(false);
    expect(await token.balanceOf(beneficiary.address)).to.equal(allocation);
    expect((await manager.getSchedule(1)).released).to.equal(allocation);
  });
});
