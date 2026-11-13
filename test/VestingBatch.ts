import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

describe("VestingManager: Atomic Batch & Lifecycle (Anggota 3)", function () {
  async function deployVestingFixture() {
    const [admin, beneficiary1, beneficiary2, unauthorized] =
      await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy();

    const VestingManager = await ethers.getContractFactory("VestingManager");
    const vestingManager = await VestingManager.deploy(
      await token.getAddress(),
    );

    return {
      vestingManager,
      token,
      admin,
      beneficiary1,
      beneficiary2,
      unauthorized,
    };
  }

  describe("createBatch", function () {
    it("Should successfully create a batch and pull exact funding", async function () {
      const { vestingManager, token, admin, beneficiary1, beneficiary2 } =
        await loadFixture(deployVestingFixture);

      const allocations = [ethers.parseEther("100"), ethers.parseEther("200")];
      const totalAllocation = allocations[0] + allocations[1];

      const currentTime = await time.latest();
      const starts = [currentTime + 1000, currentTime + 1000];
      const cliffs = [86400, 86400];
      const durations = [86400 * 30, 86400 * 30];

      await token
        .connect(admin)
        .approve(await vestingManager.getAddress(), totalAllocation);

      await expect(
        vestingManager
          .connect(admin)
          .createBatch(
            await token.getAddress(),
            [beneficiary1.address, beneficiary2.address],
            allocations,
            starts,
            cliffs,
            durations,
          ),
      )
        .to.emit(vestingManager, "BatchCreated")
        .withArgs(admin.address, 2, totalAllocation)
        .and.to.emit(vestingManager, "ScheduleCreated");

      const contractBalance = await token.balanceOf(
        await vestingManager.getAddress(),
      );
      expect(contractBalance).to.equal(totalAllocation);
    });

    it("Should revert atomically if arrays are mismatched", async function () {
      const { vestingManager, token, admin, beneficiary1 } = await loadFixture(
        deployVestingFixture,
      );

      await expect(
        vestingManager
          .connect(admin)
          .createBatch(
            await token.getAddress(),
            [beneficiary1.address],
            [ethers.parseEther("100"), ethers.parseEther("200")],
            [0],
            [0],
            [0],
          ),
      ).to.be.revertedWithCustomError(vestingManager, "ArrayLengthMismatch");
    });
  });

  describe("updateScheduleTerms", function () {
    it("Should allow admin to update cliff and duration before start time", async function () {
      const { vestingManager, token, admin, beneficiary1 } = await loadFixture(
        deployVestingFixture,
      );

      const start = (await time.latest()) + 3600;
      await token
        .connect(admin)
        .approve(await vestingManager.getAddress(), ethers.parseEther("100"));
      await vestingManager
        .connect(admin)
        .createBatch(
          await token.getAddress(),
          [beneficiary1.address],
          [ethers.parseEther("100")],
          [start],
          [1000],
          [5000],
        );

      await expect(
        vestingManager.connect(admin).updateScheduleTerms(0, 2000, 6000),
      )
        .to.emit(vestingManager, "ScheduleTermsUpdated")
        .withArgs(0, 2000, 6000);
    });
  });

  describe("cancelSchedule", function () {
    it("Should logically delete the schedule and refund admin before start time", async function () {
      const { vestingManager, token, admin, beneficiary1 } = await loadFixture(
        deployVestingFixture,
      );

      const allocation = ethers.parseEther("100");
      const start = (await time.latest()) + 3600;

      await token
        .connect(admin)
        .approve(await vestingManager.getAddress(), allocation);
      await vestingManager
        .connect(admin)
        .createBatch(
          await token.getAddress(),
          [beneficiary1.address],
          [allocation],
          [start],
          [1000],
          [5000],
        );

      const adminBalanceBefore = await token.balanceOf(admin.address);

      await expect(vestingManager.connect(admin).cancelSchedule(0))
        .to.emit(vestingManager, "ScheduleCancelled")
        .withArgs(0, beneficiary1.address, allocation);

      const adminBalanceAfter = await token.balanceOf(admin.address);
      expect(adminBalanceAfter - adminBalanceBefore).to.equal(allocation);
    });
  });
});
