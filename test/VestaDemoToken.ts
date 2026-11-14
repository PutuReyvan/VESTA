import { expect } from "chai";
import { ethers } from "hardhat";

describe("VestaDemoToken", function () {
  it("caps owner minting at MAX_SUPPLY", async function () {
    const [owner] = await ethers.getSigners();
    const token = await ethers.deployContract("VestaDemoToken");
    const maxSupply = await token.MAX_SUPPLY();

    await token.mint(owner.address, maxSupply);
    await expect(token.mint(owner.address, 1n))
      .to.be.revertedWithCustomError(token, "MaxSupplyExceeded")
      .withArgs(1n, maxSupply);
  });

  it("rejects minting above the remaining cap", async function () {
    const [owner] = await ethers.getSigners();
    const token = await ethers.deployContract("VestaDemoToken");
    const maxSupply = await token.MAX_SUPPLY();

    await token.mint(owner.address, maxSupply - 1n);
    await expect(token.mint(owner.address, 2n))
      .to.be.revertedWithCustomError(token, "MaxSupplyExceeded")
      .withArgs(2n, maxSupply);
  });
});
