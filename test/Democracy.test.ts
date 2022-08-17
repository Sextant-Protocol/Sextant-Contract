import { ethers } from "hardhat";
import chai from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// eslint-disable-next-line node/no-missing-import
import { MockDemocracy, FundShareToken, MockToken } from "../typechain";
const { BigNumber } = ethers;

const { expect } = chai;

async function withDecimals18(amount: string) {
  return BigNumber.from(amount).mul(BigNumber.from(10).pow(18)).toString();
}

describe("Democracy", () => {
  let democracy: MockDemocracy;
  let fundShareToken: FundShareToken;
  let usdc: MockToken;
  let usdt: MockToken;

  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let alice: SignerWithAddress;
  let adminUser: SignerWithAddress;
  let mockFundAddr: SignerWithAddress;

  beforeEach(async () => {
    // 1
    signers = await ethers.getSigners();
    [owner, user, alice, adminUser, mockFundAddr] = await ethers.getSigners();
    // 2
    const Democracy = await ethers.getContractFactory("MockDemocracy", owner);
    democracy = await Democracy.deploy();
    await democracy.deployed();

    const MockToken = await ethers.getContractFactory("MockToken", owner);
    usdc = await MockToken.deploy("USD Coin", "USDC");
    await usdc.deployed();
    usdt = await MockToken.deploy("USD Toin", "USDT");
    await usdt.deployed();

    const FundShareToken = await ethers.getContractFactory(
      "FundShareToken",
      owner
    );
    fundShareToken = await FundShareToken.deploy();
    await fundShareToken.deployed();
    await fundShareToken["initialize(string,string,address[],address)"](
      "FundShareToken01",
      "FST01",
      [usdc.address, usdt.address],
      mockFundAddr.address
    );

    await democracy.initialize(
      fundShareToken.address,
      await withDecimals18("100"),
      "2",
      "1200",
      mockFundAddr.address
    );
  });

  describe("initialized state", async () => {
    it("initialize", async () => {
      const powerToken: string = await democracy.powerToken();
      const proposalNeed = await democracy.proposalNeed();
      const voteUsersNeed = await democracy.voteUsersNeed();
      const voteDuration = await democracy.voteDuration();
      const beGoverned: string = await democracy.beGoverned();
      expect(powerToken).to.eq(fundShareToken.address.toString());
      expect(proposalNeed).to.eq(await withDecimals18("100"));
      expect(voteUsersNeed).to.eq("2");
      expect(voteDuration).to.eq("1200");
      expect(beGoverned).to.eq(mockFundAddr.address.toString());
      expect(await democracy.owner()).to.be.equal(await owner.getAddress());
    });
  });

  describe("setParameter", function () {
    const proposalNeed = "proposalNeed";
    const voteUsersNeed = "voteUsersNeed";
    const voteDuration = "voteDuration";
    const value = 12;
    it("should be invoke by onwer", async function () {
      await expect(
        democracy.connect(user).setParameters(proposalNeed, value)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("parameter can be set to value", async function () {
      await democracy.setParameters(proposalNeed, value);
      expect(await democracy.proposalNeed()).to.equal(value);
      await democracy.setParameters(voteUsersNeed, value);
      expect(await democracy.voteUsersNeed()).to.equal(value);
      await democracy.setParameters(voteDuration, value);
      expect(await democracy.voteDuration()).to.equal(value);
    });

    it("no such parameter can be set error", async () => {
      await expect(
        democracy.setParameters("errorName", value)
      ).to.be.revertedWith("No such parameter can be set");
    });
  });

  describe("modify administrator", async () => {
    it("only owner can modify admin", async function () {
      await expect(
        democracy.connect(alice).setAdmin(adminUser.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("set administrator states", async function () {
      expect(await democracy.admin(adminUser.address)).to.be.equals(false);
      await democracy.setAdmin(adminUser.address, true);
      expect(await democracy.admin(adminUser.address)).to.be.equals(true);
      await democracy.setAdmin(adminUser.address, false);
      expect(await democracy.admin(adminUser.address)).to.be.equals(false);
    });
  });

  describe("getPropState", function () {
    it("getProp state is zero in initialize", async function () {
      const state = await democracy.getPropState(0);
      expect(state).to.equal(0);
    });
  });

  describe("proposal", function () {
    it("hasProposal is false in initialize", async function () {
      const hasProposal = await democracy.hasProposal();
      expect(hasProposal).to.equal(false);
    });
  });

  describe("countingVote", function () {
    let _powerSupply;
    let _approve;
    let _against;
    it("not pass", async function () {
      _powerSupply = await withDecimals18("10000");
      _approve = await withDecimals18("100");
      _against = await withDecimals18("100");
      expect(
        await democracy.countingVote(_approve, _against, _powerSupply)
      ).to.be.equal(false);
    });

    it("vote pass", async function () {
      _powerSupply = await withDecimals18("10000");
      _approve = await withDecimals18("500");
      _against = await withDecimals18("100");
      expect(
        await democracy.countingVote(_approve, _against, _powerSupply)
      ).to.be.equal(true);
    });

    it("no againt", async function () {
      _powerSupply = await withDecimals18("10000");
      _approve = await withDecimals18("1");
      console.log("approve is:", _approve);
      _against = await withDecimals18("0");
      expect(
        await democracy.countingVote(_approve, _against, _powerSupply)
      ).to.be.equal(true);
    });

    it("no approve", async function () {
      _powerSupply = await withDecimals18("10000");
      _approve = await withDecimals18("0");
      _against = await withDecimals18("10");
      expect(
        await democracy.countingVote(_approve, _against, _powerSupply)
      ).to.be.equal(false);
    });
  });
});
