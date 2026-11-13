import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("VestingManager batch creation", function () {
  async function deployFixture() {
    const [admin, beneficiary1, beneficiary2, other] =
      await ethers.getSigners();
    const token = await ethers.deployContract("MockERC20");
    const manager = await ethers.deployContract("VestingManager", [
      token.target,
    ]);
    const minted = ethers.parseEther("10000");

    await token.mint(admin.address, minted);

    return {
      admin,
      beneficiary1,
      beneficiary2,
      other,
      token,
      manager,
      minted,
    };
  }

  it("accepts a one-row batch and encodes no cliff as start", async function () {
    const { admin, beneficiary1, token, manager } =
      await loadFixture(deployFixture);
    const start = (await time.latest()) + 1_000;
    const allocation = 100n;

    await token.approve(manager.target, allocation);
    await manager.createBatch(
      token.target,
      [beneficiary1.address],
      [allocation],
      [start],
      [start],
      [1_000],
    );

    const schedule = await manager.getSchedule(0);
    expect(schedule.cliff).to.equal(BigInt(start));
    expect(await manager.nextScheduleId()).to.equal(1n);
    expect(await manager.getBeneficiarySchedules(beneficiary1.address)).to.eql([
      0n,
    ]);
    expect(await token.balanceOf(manager.target)).to.equal(allocation);
    expect(await token.balanceOf(admin.address)).to.equal(
      ethers.parseEther("10000") - allocation,
    );
  });

  it("accepts a twenty-row batch", async function () {
    const { beneficiary1, token, manager } = await loadFixture(deployFixture);
    const start = (await time.latest()) + 1_000;
    const beneficiaries = Array(20).fill(beneficiary1.address);
    const allocations = Array<bigint>(20).fill(1n);
    const starts = Array<number>(20).fill(start);
    const cliffs = Array<number>(20).fill(start);
    const durations = Array<number>(20).fill(1_000);

    await token.approve(manager.target, 20n);
    await manager.createBatch(
      token.target,
      beneficiaries,
      allocations,
      starts,
      cliffs,
      durations,
    );

    expect(await manager.nextScheduleId()).to.equal(20n);
    expect(await manager.getBeneficiarySchedules(beneficiary1.address)).to.eql(
      Array.from({ length: 20 }, (_, index) => BigInt(index)),
    );
    expect(await token.balanceOf(manager.target)).to.equal(20n);
  });

  it("rejects a twenty-one-row batch", async function () {
    const { beneficiary1, token, manager } = await loadFixture(deployFixture);
    const start = (await time.latest()) + 1_000;

    await expect(
      manager.createBatch(
        token.target,
        Array(21).fill(beneficiary1.address),
        Array<bigint>(21).fill(1n),
        Array<number>(21).fill(start),
        Array<number>(21).fill(start),
        Array<number>(21).fill(1_000),
      ),
    ).to.be.revertedWithCustomError(manager, "BatchTooLarge");

    expect(await manager.nextScheduleId()).to.equal(0n);
    expect(await token.balanceOf(manager.target)).to.equal(0n);
  });

  it("pulls funding once and emits the complete batch payload", async function () {
    const { admin, beneficiary1, beneficiary2, token, manager } =
      await loadFixture(deployFixture);
    const start = (await time.latest()) + 1_000;

    await token.approve(manager.target, 31n);
    await manager.createBatch(
      token.target,
      [beneficiary1.address],
      [7n],
      [start],
      [start],
      [1_000],
    );

    const transaction = await manager.createBatch(
      token.target,
      [beneficiary1.address, beneficiary2.address],
      [11n, 13n],
      [start, start],
      [start, start],
      [1_000, 1_000],
    );

    await expect(transaction)
      .to.emit(manager, "BatchCreated")
      .withArgs(admin.address, 1n, 2n, 24n);

    const receipt = await transaction.wait();
    const pulls = await token.queryFilter(
      token.filters.Transfer(admin.address, manager.target),
      receipt!.blockNumber,
      receipt!.blockNumber,
    );
    expect(pulls).to.have.length(1);
    const pull = pulls[0];
    expect(pull).to.have.property("args");
    if (!("args" in pull)) throw new Error("expected a decoded Transfer log");
    expect(pull.args.value).to.equal(24n);
  });

  it("rolls back every row when a middle row is invalid", async function () {
    const { admin, beneficiary1, beneficiary2, token, manager, minted } =
      await loadFixture(deployFixture);
    const start = (await time.latest()) + 1_000;

    await token.approve(manager.target, 60n);

    await expect(
      manager.createBatch(
        token.target,
        [beneficiary1.address, ethers.ZeroAddress, beneficiary2.address],
        [10n, 20n, 30n],
        [start, start, start],
        [start, start, start],
        [1_000, 1_000, 1_000],
      ),
    ).to.be.revertedWithCustomError(manager, "InvalidBeneficiary");

    expect(await manager.nextScheduleId()).to.equal(0n);
    expect(await manager.getBeneficiarySchedules(beneficiary1.address)).to.eql(
      [],
    );
    expect(await manager.getBeneficiarySchedules(beneficiary2.address)).to.eql(
      [],
    );
    expect(await token.balanceOf(manager.target)).to.equal(0n);
    expect(await token.balanceOf(admin.address)).to.equal(minted);
  });

  it("rolls back schedules when the admin cannot fund the batch", async function () {
    const { admin, beneficiary1, token, manager, minted } =
      await loadFixture(deployFixture);
    const start = (await time.latest()) + 1_000;
    const allocation = minted + 1n;

    await token.approve(manager.target, allocation);

    await expect(
      manager.createBatch(
        token.target,
        [beneficiary1.address],
        [allocation],
        [start],
        [start],
        [1_000],
      ),
    ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");

    expect(await manager.nextScheduleId()).to.equal(0n);
    expect(await manager.getBeneficiarySchedules(beneficiary1.address)).to.eql(
      [],
    );
    expect(await token.balanceOf(manager.target)).to.equal(0n);
    expect(await token.balanceOf(admin.address)).to.equal(minted);
  });

  it("rolls back when a token delivers less than the requested funding", async function () {
    const [admin, beneficiary] = await ethers.getSigners();
    const token = await ethers.deployContract("FeeOnTransferMockERC20");
    const manager = await ethers.deployContract("VestingManager", [
      token.target,
    ]);
    const start = (await time.latest()) + 1_000;

    await token.mint(admin.address, 100n);
    await token.approve(manager.target, 100n);

    await expect(
      manager.createBatch(
        token.target,
        [beneficiary.address],
        [100n],
        [start],
        [start],
        [1_000],
      ),
    )
      .to.be.revertedWithCustomError(manager, "IncorrectReceivedFunding")
      .withArgs(100n, 99n);

    expect(await manager.nextScheduleId()).to.equal(0n);
    expect(await manager.getBeneficiarySchedules(beneficiary.address)).to.eql(
      [],
    );
    expect(await token.balanceOf(manager.target)).to.equal(0n);
    expect(await token.balanceOf(admin.address)).to.equal(100n);
  });

  it("rejects batch creation from a non-admin wallet", async function () {
    const { beneficiary1, other, token, manager } =
      await loadFixture(deployFixture);
    const start = (await time.latest()) + 1_000;
    const createBatch = manager.connect(other).getFunction("createBatch");

    await expect(
      createBatch(
        token.target,
        [beneficiary1.address],
        [1n],
        [start],
        [start],
        [1_000],
      ),
    ).to.be.revertedWithCustomError(manager, "Unauthorized");
  });

  it("rejects relative cliff values", async function () {
    const { beneficiary1, token, manager } = await loadFixture(deployFixture);
    const start = (await time.latest()) + 1_000;

    await expect(
      manager.createBatch(
        token.target,
        [beneficiary1.address],
        [1n],
        [start],
        [100],
        [1_000],
      ),
    ).to.be.revertedWithCustomError(manager, "InvalidScheduleTerms");
  });

  it("rejects a cliff after the vesting end", async function () {
    const { beneficiary1, token, manager } = await loadFixture(deployFixture);
    const start = (await time.latest()) + 1_000;

    await expect(
      manager.createBatch(
        token.target,
        [beneficiary1.address],
        [1n],
        [start],
        [start + 1_001],
        [1_000],
      ),
    ).to.be.revertedWithCustomError(manager, "InvalidScheduleTerms");
  });

  it("rejects a zero start", async function () {
    const { beneficiary1, token, manager } = await loadFixture(deployFixture);
    await expect(
      manager.createBatch(
        token.target,
        [beneficiary1.address],
        [1n],
        [0],
        [0],
        [1_000],
      ),
    ).to.be.revertedWithCustomError(manager, "InvalidScheduleTerms");
  });

  it("rejects a zero duration", async function () {
    const { beneficiary1, token, manager } = await loadFixture(deployFixture);
    const start = (await time.latest()) + 1_000;

    await expect(
      manager.createBatch(
        token.target,
        [beneficiary1.address],
        [1n],
        [start],
        [start],
        [0],
      ),
    ).to.be.revertedWithCustomError(manager, "InvalidScheduleTerms");
  });
});
