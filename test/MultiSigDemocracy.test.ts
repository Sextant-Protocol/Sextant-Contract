import { ethers } from "hardhat";
import chai from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// eslint-disable-next-line node/no-missing-import
import {
  MultiSigDemocracyImpl,
  PowerTokenMock,
  MockToken,
  FundMock,
  FundFactory,
  InvestPolicyTemplate,
  UserHistory,
  MultiSigWallet,
  InvestPolicy,
  OracleV3,
} from "../typechain";
import { advanceTimeAndBlock,latestBlock,advanceBlockTo} from "./utilities/time";
const { BigNumber } = ethers;

const { expect } = chai;

let VOTE_DURATION = 1200;
let lock_duration = VOTE_DURATION ;

async function withDecimals18(amount: string) {
  return BigNumber.from(amount).mul(BigNumber.from(10).pow(18)).toString();
}

describe("MultiSigDemocracyImpl", async () => {
  let fund: FundMock;
  let fundFactory: FundFactory;

  let multiSigDemocracy: MultiSigDemocracyImpl;
  let powerToken: PowerTokenMock;
  let investPolicyTemplate: InvestPolicyTemplate;

  let userHistory: UserHistory;
  let multiSigWallet: MultiSigWallet;
  let investPoli_: InvestPolicy;
  let oracle: OracleV3;

  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob : SignerWithAddress;
  let adminUser: SignerWithAddress;
  
  let defi1: SignerWithAddress;
  let defi2: SignerWithAddress;
  let defi3: SignerWithAddress;
  let addrs: SignerWithAddress[];

  let usdt: MockToken;
  let usdc: MockToken;
  let hip: MockToken;
  let cyn: MockToken;
  let unswapToken: MockToken;

  type fData = {
    name: string,
    investPolicy: string,
    closedPeriod: number,
    redemptionPeriod: number,
    minOpenInterest: number,
    sponsorDivideRatio: number,
    raiseData: {
      raiseToken: string,
      targetRaiseShare: number,
      initialNetValue: number,
      minRaiseShare: number,
      isHardTop: boolean,
      raisePeriod: number,
      minSharePurchase: number,
      maxSharePurchase: number,
    },
    bonusData: {
      bonusPeriod: number,
      bonusRatio: number,
      managerBonusDivideRatio: number,
    },
    manageData: {
      managers: string[],
      numberOfNeedSignedAddresses: number,
      managerFeeRatio: number,
    },
  };
  let _fundData: fData;
  let _fundNo: number;

  beforeEach(async () => {
    // 1
    signers = await ethers.getSigners();
    [owner, user, alice, bob, adminUser, defi1, defi2, defi3, ...addrs] = await ethers.getSigners();
    // 2

    const Fund = await ethers.getContractFactory("FundMock", owner);
    fund = await Fund.deploy();
    await fund.deployed();

    const FundFactory = await ethers.getContractFactory("FundFactory", owner);
    fundFactory = await FundFactory.deploy();
    await fundFactory.deployed();

    const MultiSigDemocracyImpl = await ethers.getContractFactory("MultiSigDemocracyImpl", owner);
    multiSigDemocracy = await MultiSigDemocracyImpl.deploy();
    await multiSigDemocracy.deployed();

    const MockToken = await ethers.getContractFactory("MockToken", owner);
    usdt = await MockToken.deploy("Tether USD", "USDT");
    await usdt.deployed(); // invalid token
    usdc = await MockToken.deploy("USD Coin", "USDC");
    await usdc.deployed(); // local token
    hip = await MockToken.deploy("Hippo Token", "HIP");
    await hip.deployed(); // can swap token
    cyn = await MockToken.deploy("Cycan Network Token", "CYN");
    await cyn.deployed(); // can swap token
    unswapToken = await MockToken.deploy("Unswap Token", "UnswapT");
    await unswapToken.deployed(); // can not swap token

    const UserHistory = await ethers.getContractFactory("UserHistory", owner);
    userHistory = await UserHistory.deploy();
    await userHistory.deployed();

    const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet", owner);
    multiSigWallet = await MultiSigWallet.deploy();
    await multiSigWallet.deployed();

    const InvestPolicyTemplate = await ethers.getContractFactory("InvestPolicyTemplate", owner);
    investPolicyTemplate = await InvestPolicyTemplate.deploy();
    await investPolicyTemplate.deployed();

    const OracleV3 = await ethers.getContractFactory("OracleV3", owner);
    oracle = await OracleV3.deploy();
    await oracle.deployed();

    const InvestPolicy = await ethers.getContractFactory("InvestPolicy", owner);
    investPoli_ = await InvestPolicy.deploy(
        [defi1.address, defi2.address],
        [hip.address, usdt.address],
        usdc.address,
        investPolicyTemplate.address,
        "detail",
        fund.address,
        oracle.address
    );
    await investPoli_.deployed();

    const PowerToken = await ethers.getContractFactory(
      "PowerTokenMock",
      owner
    );
    powerToken = await PowerToken.deploy();
    await powerToken.deployed();
    await powerToken
    await powerToken["initialize(string,string,address,address[])"](
      "PowerToken",
      "PWT",
      fund.address,
      [owner.address, alice.address],
    );

    await multiSigDemocracy.initialize(
      powerToken.address,
      await withDecimals18("1"),
      "2",
      "1200",
      fund.address
    );

    await userHistory.initialize();
    await fundFactory.initialize(
        investPolicyTemplate.address,
        userHistory.address,
        multiSigWallet.address,
        oracle.address,
        owner.address
    );
    _fundNo = 6;
    _fundData = {
        name: "66token",
        investPolicy: investPoli_.address,
        closedPeriod: 20,
        redemptionPeriod: 20,
        minOpenInterest: 200,
        sponsorDivideRatio: 2000,
        raiseData: {
            raiseToken: usdc.address,
            targetRaiseShare: 20000,
            initialNetValue: 20,
            minRaiseShare: 200,
            isHardTop: false,
            raisePeriod: 20,
            minSharePurchase: 200,
            maxSharePurchase: 5000,
        },
        bonusData: {
            bonusPeriod: 20,
            bonusRatio: 2000,
            managerBonusDivideRatio: 2000,
        },
        manageData: {
            managers: [owner.address, alice.address,user.address,adminUser.address,bob.address],
            numberOfNeedSignedAddresses: 2,
            managerFeeRatio: 100,
        },
    };
    await fund.initialize(
        owner.address,
        _fundNo,
        _fundData,
        fundFactory.address,
        powerToken.address,
        userHistory.address,
        multiSigWallet.address
    );

    await fund.setInternal(multiSigDemocracy.address,true);

    let mintAmount = await withDecimals18("1");
    for(let i =0; i<signers.length; i++) {
      await powerToken.mint(signers[i].address, mintAmount);
      await powerToken.connect(signers[i])
          .approveLock(multiSigDemocracy.address, mintAmount, lock_duration);
    }
    let newNeedNumber = 4;
    await multiSigDemocracy.connect(alice).toProposal(
      "ChangeNumberOfNeedSignedAddresses", 
      ethers.constants.AddressZero,
      newNeedNumber,false
    );

    let lastId = await multiSigDemocracy.lastID();
    console.log("lastId:",lastId);
  });

  describe("initialize and make a normal proposal",async () => {

    before(async function() {
      console.log("Cannot get Global variable:",multiSigDemocracy);
    })

    it("initialize", async () => {
      const _powerToken: string = await multiSigDemocracy.powerToken();
      const proposalNeed = await multiSigDemocracy.proposalNeed();
      const voteUsersNeed = await multiSigDemocracy.voteUsersNeed();
      const voteDuration = await multiSigDemocracy.voteDuration();
      const beGoverned: string = await multiSigDemocracy.beGoverned();
      expect(_powerToken).to.eq(powerToken.address.toString());
      expect(proposalNeed).to.eq(await withDecimals18("1"));
      expect(voteUsersNeed).to.eq("2");
      expect(voteDuration).to.eq("1200");
      expect(beGoverned).to.eq(fund.address.toString());
      expect(await multiSigDemocracy.owner()).to.be.equal(await owner.getAddress());
    });

    describe("make votes", function () {
      it("Poll can't be zero", async function () {
          await expect(multiSigDemocracy.toVote(1,0)).to.be.revertedWith("Poll can't be zero");
      });
      it("Not at vote status", async function () {
        let unexsitedId = "10";
        await expect(multiSigDemocracy.toVote(unexsitedId,await withDecimals18("1"))).to.be.revertedWith("Not at vote status");
      });

      it("vote a proposal", async function () {
          // make the proposal state is 2
          let timeBlock = await latestBlock();
          console.log("timeBlock is:", timeBlock);
          await advanceBlockTo(timeBlock + VOTE_DURATION/2);
          let newtimeBlock = await latestBlock();
          console.log("newtimeBlock is:", newtimeBlock);
          let state = await multiSigDemocracy.getPropState(0);
          console.log("proposal state is :", state);

          let lastId = await multiSigDemocracy.lastID();
          let voteAmount = "1";
          await multiSigDemocracy.toVote(lastId,await withDecimals18(voteAmount));
        
          let [_approved, _against, _voters] = await multiSigDemocracy.getVoteData(lastId);
          console.log("voteData1 is:", _approved.toString(), _against.toString(), _voters.toString());
          expect(_approved.toString()).to.be.equals(await withDecimals18(voteAmount));
          expect(_against.toString()).to.be.equals("0");
          expect(_voters.toString()).to.be.equals("1");
          // repeat a proposal
          await expect(multiSigDemocracy.toVote(lastId,await withDecimals18(voteAmount)))
              .revertedWith("Already vote the proposal!");
          await expect(multiSigDemocracy.connect(alice).toVote(lastId,await withDecimals18(voteAmount)))
          .to.be.revertedWith("amount == 0 or passed duration");

          await multiSigDemocracy.connect(user).toVote(lastId,await withDecimals18(voteAmount));
          lastId = await multiSigDemocracy.lastID();
          [_approved, _against, _voters] = await multiSigDemocracy.getVoteData(lastId);
          console.log("voteData2 is:", _approved.toString(), _against.toString(), _voters.toString());
          expect(_approved.toString()).to.be.equals(await withDecimals18((parseInt(voteAmount)*2).toString()));
          expect(_against.toString()).to.be.equals("0");
          expect(_voters.toString()).to.be.equals("2");

          let nagetiveVoteAmount = "-1"
          await multiSigDemocracy.connect(bob).toVote(1,await withDecimals18(nagetiveVoteAmount));
          lastId = await multiSigDemocracy.lastID();
          [_approved, _against, _voters] = await multiSigDemocracy.getVoteData(lastId);
          expect(_approved.toString()).to.be.equals(await withDecimals18((parseInt(voteAmount)*2).toString()));
          expect(_against.toString()).to.be.equals(await withDecimals18(voteAmount));
          expect(_voters.toString()).to.be.equals("3");
          expect(await multiSigDemocracy.getVoteResult(lastId)).to.be.equals(0);
          multiSigDemocracy.connect(adminUser).toVote(lastId,await withDecimals18((parseInt(voteAmount)*3).toString()));
          await advanceBlockTo(timeBlock + VOTE_DURATION);
          expect(await multiSigDemocracy.getPropState(lastId)).to.be.equals(5);
          expect(await multiSigDemocracy.getVoteResult(lastId)).to.be.equals(1);
      });
    });

    describe("execute proposal and update", function () {
        it("proposal failed", async function () {
          let newNeedNumber = 6;
          let errorName = "errorName";
          await expect(multiSigDemocracy.connect(bob).toProposal(
            errorName, 
            ethers.constants.AddressZero,
            newNeedNumber,false
          )).to.be.revertedWith("Can't raise this kind of proposal");

          
          await expect(multiSigDemocracy.connect(bob).toProposal(
            "ChangeNumberOfNeedSignedAddresses", 
            ethers.constants.AddressZero,
            newNeedNumber,false
          )).to.be.revertedWith("Has unaccomplished proposal");
        });

        it("update a 'ChangeNumberOfNeedSignedAddresses' proposal", async function () {
            // make the proposal state is 2
            let timeBlock = await latestBlock();
            console.log("timeBlock is:", timeBlock);
            await advanceBlockTo(timeBlock + VOTE_DURATION/2);
            let newtimeBlock = await latestBlock();
            console.log("newtimeBlock is:", newtimeBlock);

            let lastId = await multiSigDemocracy.lastID();
            let state = await multiSigDemocracy.getPropState(lastId);
            console.log("proposal state is :", state);
            let voteAmount = "1";
            await multiSigDemocracy.toVote(lastId,await withDecimals18(voteAmount));
            lastId = await multiSigDemocracy.lastID();
            let [_approved, _against, _voters] = await multiSigDemocracy.getVoteData(lastId);
            console.log("voteData is:", _approved.toString(), _against.toString(), _voters.toString());
            expect(_approved.toString()).to.be.equals(await withDecimals18(voteAmount));
            expect(_against.toString()).to.be.equals("0");
            expect(_voters.toString()).to.be.equals("1");
            // repeat a proposal
            await expect(multiSigDemocracy.toVote(lastId,await withDecimals18(voteAmount)))
                .revertedWith("Already vote the proposal!");
            await expect(multiSigDemocracy.connect(alice).toVote(lastId,await withDecimals18(voteAmount),{from:alice.address}))
            .to.be.revertedWith("amount == 0 or passed duration");

            await multiSigDemocracy.connect(user).toVote(lastId,await withDecimals18(voteAmount),{from:user.address});
            lastId = await multiSigDemocracy.lastID();
            [_approved, _against, _voters] = await multiSigDemocracy.getVoteData(lastId);
            expect(_approved.toString()).to.be.equals(await withDecimals18((parseInt(voteAmount)*2).toString()));
            expect(_against.toString()).to.be.equals("0");
            expect(_voters.toString()).to.be.equals("2");
            let negativeVoteAmount = "-1"
            await multiSigDemocracy.connect(bob).toVote(lastId,await withDecimals18(negativeVoteAmount));
            lastId = await multiSigDemocracy.lastID();
            [_approved, _against, _voters] = await multiSigDemocracy.getVoteData(lastId);
            expect(_approved.toString()).to.be.equals(await withDecimals18((parseInt(voteAmount)*2).toString()));
            expect(_against.toString()).to.be.equals(await withDecimals18(voteAmount));
            expect(_voters.toString()).to.be.equals("3");
            expect(await multiSigDemocracy.getVoteResult(lastId)).to.be.equals(0);
            multiSigDemocracy.connect(adminUser).toVote(lastId,await withDecimals18((parseInt(voteAmount)*3).toString()));
            await advanceBlockTo(timeBlock + VOTE_DURATION);
            expect(await multiSigDemocracy.getPropState(lastId)).to.be.equals(5);
            expect(await multiSigDemocracy.getVoteResult(lastId)).to.be.equals(1);

            let curNeedNum = await fund.getNumberOfNeedSignedAddresses();
            console.log(lastId," curNeedNum is:",curNeedNum.toString());
            expect(curNeedNum).to.equals(2);

            await fund.setStatus(3);//3 == CLOSED
            await multiSigDemocracy["update()"]();

            curNeedNum = await fund.getNumberOfNeedSignedAddresses();
            console.log(lastId," curNeedNum is:",curNeedNum.toString());
            expect(curNeedNum).to.equals(4);
            console.log("the state after update is:",await multiSigDemocracy.hasProposal());
            
        });
      });


});

});
