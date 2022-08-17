import { ethers } from "hardhat";
import chai from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
// eslint-disable-next-line node/no-missing-import
import {
  BasicDemocracyImpl,
  FundShareToken,
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

describe("BasicDemocracyImpl", async () => {
  let fund: FundMock;
  let fundFactory: FundFactory;

  let basicDemocracy: BasicDemocracyImpl;
  let fundShareToken: FundShareToken;
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
  //let mockFundAddr: SignerWithAddress;
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

    const BasicDemocracyImpl = await ethers.getContractFactory("BasicDemocracyImpl", owner);
    basicDemocracy = await BasicDemocracyImpl.deploy();
    await basicDemocracy.deployed();

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
      fund.address
    );

    await basicDemocracy.initialize(
      fundShareToken.address,
      await withDecimals18("100"),
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
            managers: [owner.address, alice.address],
            numberOfNeedSignedAddresses: 2,
            managerFeeRatio: 100,
        },
    };
    await fund.initialize(
        owner.address,
        _fundNo,
        _fundData,
        fundFactory.address,
        fundShareToken.address,
        userHistory.address,
        multiSigWallet.address
    );

    await fund.setInternal(basicDemocracy.address,true);

    let mintAmount = await withDecimals18("1000");
    for(let i =0; i<signers.length; i++) {
      await fundShareToken.mint(signers[i].address, mintAmount);
      await fundShareToken.connect(signers[i])
          .approveLock(basicDemocracy.address, mintAmount, lock_duration);
    }
    
    let reason:string = "Can lanuch fund liquidation";
    let detail:string = "it is time to lanuch fund liquidation";
    await basicDemocracy.connect(alice)["toProposal(string,address,uint256,bool,string,string)"]
    ("FundLiquidation", ethers.constants.AddressZero,ethers.constants.Zero,false, reason,detail);

    let lastId = await basicDemocracy.lastID();
    console.log("lastId:",lastId);
  });

  describe("initialize and make a normal proposal",async () => {

    before(async function() {
      console.log("Cannot get Global variable:",basicDemocracy);
    })

    it("initialize", async () => {
      const powerToken: string = await basicDemocracy.powerToken();
      const proposalNeed = await basicDemocracy.proposalNeed();
      const voteUsersNeed = await basicDemocracy.voteUsersNeed();
      const voteDuration = await basicDemocracy.voteDuration();
      const beGoverned: string = await basicDemocracy.beGoverned();
      expect(powerToken).to.eq(fundShareToken.address.toString());
      expect(proposalNeed).to.eq(await withDecimals18("100"));
      expect(voteUsersNeed).to.eq("2");
      expect(voteDuration).to.eq("1200");
      expect(beGoverned).to.eq(fund.address.toString());
      expect(await basicDemocracy.owner()).to.be.equal(await owner.getAddress());
    });

    describe("make votes", function () {
      it("Poll can't be zero", async function () {
          await expect(basicDemocracy.toVote(1,0)).to.be.revertedWith("Poll can't be zero");
      });
      it("Not at vote status", async function () {
        let unexsitedId = "10";
        await expect(basicDemocracy.toVote(unexsitedId,await withDecimals18("100"))).to.be.revertedWith("Not at vote status");
      });

      it("vote a proposal", async function () {
          // make the proposal state is 2
          let timeBlock = await latestBlock();
          console.log("timeBlock is:", timeBlock);
          await advanceBlockTo(timeBlock + VOTE_DURATION/2);
          let newtimeBlock = await latestBlock();
          console.log("newtimeBlock is:", newtimeBlock);
          let state = await basicDemocracy.getPropState(0);
          console.log("proposal state is :", state);

          let lastId = await basicDemocracy.lastID();
          let voteAmount = "100";
          await basicDemocracy.toVote(lastId,await withDecimals18(voteAmount));
        
          let [_approved, _against, _voters] = await basicDemocracy.getVoteData(lastId);
          console.log("voteData1 is:", _approved.toString(), _against.toString(), _voters.toString());
          expect(_approved.toString()).to.be.equals(await withDecimals18(voteAmount));
          expect(_against.toString()).to.be.equals("0");
          expect(_voters.toString()).to.be.equals("1");
          // repeat a proposal
          await expect(basicDemocracy.toVote(lastId,await withDecimals18(voteAmount)))
              .revertedWith("Already vote the proposal!");
          await expect(basicDemocracy.connect(alice).toVote(lastId,await withDecimals18(voteAmount)))
          .to.be.revertedWith("amount == 0 or passed duration");

          await basicDemocracy.connect(user).toVote(lastId,await withDecimals18(voteAmount));
          lastId = await basicDemocracy.lastID();
          [_approved, _against, _voters] = await basicDemocracy.getVoteData(lastId);
          console.log("voteData2 is:", _approved.toString(), _against.toString(), _voters.toString());
          expect(_approved.toString()).to.be.equals(await withDecimals18((parseInt(voteAmount)*2).toString()));
          expect(_against.toString()).to.be.equals("0");
          expect(_voters.toString()).to.be.equals("2");

          let nagetiveVoteAmount = "-100"
          await basicDemocracy.connect(bob).toVote(1,await withDecimals18(nagetiveVoteAmount));
          lastId = await basicDemocracy.lastID();
          [_approved, _against, _voters] = await basicDemocracy.getVoteData(lastId);
          expect(_approved.toString()).to.be.equals(await withDecimals18((parseInt(voteAmount)*2).toString()));
          expect(_against.toString()).to.be.equals(await withDecimals18(voteAmount));
          expect(_voters.toString()).to.be.equals("3");
          expect(await basicDemocracy.getVoteResult(lastId)).to.be.equals(0);
          basicDemocracy.connect(adminUser).toVote(lastId,await withDecimals18((parseInt(voteAmount)*3).toString()));
          await advanceBlockTo(timeBlock + VOTE_DURATION);
          expect(await basicDemocracy.getPropState(lastId)).to.be.equals(5);
          expect(await basicDemocracy.getVoteResult(lastId)).to.be.equals(1);
      });
    });

    describe("execute proposal and update", function () {
        it("update a FundLiquidation proposal", async function () {
            // make the proposal state is 2
            let timeBlock = await latestBlock();
            console.log("timeBlock is:", timeBlock);
            await advanceBlockTo(timeBlock + VOTE_DURATION/2);
            let newtimeBlock = await latestBlock();
            console.log("newtimeBlock is:", newtimeBlock);

            let lastId = await basicDemocracy.lastID();
            let state = await basicDemocracy.getPropState(lastId);
            console.log("proposal state is :", state);
            let voteAmount = "100";
            await basicDemocracy.toVote(lastId,await withDecimals18(voteAmount));
            lastId = await basicDemocracy.lastID();
            let [_approved, _against, _voters] = await basicDemocracy.getVoteData(lastId);
            console.log("voteData is:", _approved.toString(), _against.toString(), _voters.toString());
            expect(_approved.toString()).to.be.equals(await withDecimals18(voteAmount));
            expect(_against.toString()).to.be.equals("0");
            expect(_voters.toString()).to.be.equals("1");
            // repeat a proposal
            await expect(basicDemocracy.toVote(lastId,await withDecimals18(voteAmount)))
                .revertedWith("Already vote the proposal!");
            await expect(basicDemocracy.connect(alice).toVote(lastId,await withDecimals18(voteAmount),{from:alice.address}))
            .to.be.revertedWith("amount == 0 or passed duration");

            await basicDemocracy.connect(user).toVote(lastId,await withDecimals18(voteAmount),{from:user.address});
            lastId = await basicDemocracy.lastID();
            [_approved, _against, _voters] = await basicDemocracy.getVoteData(lastId);
            expect(_approved.toString()).to.be.equals(await withDecimals18((parseInt(voteAmount)*2).toString()));
            expect(_against.toString()).to.be.equals("0");
            expect(_voters.toString()).to.be.equals("2");
            let negativeVoteAmount = "-100"
            await basicDemocracy.connect(bob).toVote(lastId,await withDecimals18(negativeVoteAmount));
            lastId = await basicDemocracy.lastID();
            [_approved, _against, _voters] = await basicDemocracy.getVoteData(lastId);
            expect(_approved.toString()).to.be.equals(await withDecimals18((parseInt(voteAmount)*2).toString()));
            expect(_against.toString()).to.be.equals(await withDecimals18(voteAmount));
            expect(_voters.toString()).to.be.equals("3");
            expect(await basicDemocracy.getVoteResult(lastId)).to.be.equals(0);
            basicDemocracy.connect(adminUser).toVote(lastId,await withDecimals18((parseInt(voteAmount)*3).toString()));
            await advanceBlockTo(timeBlock + VOTE_DURATION);
            expect(await basicDemocracy.getPropState(lastId)).to.be.equals(5);
            expect(await basicDemocracy.getVoteResult(lastId)).to.be.equals(1);

            await fund.setStatus(3);//3 == CLOSED
            await basicDemocracy.update(lastId);

            let curStatus = await fund.status();
            console.log(lastId," curStatus is:",curStatus.toString());
            expect(curStatus).to.equals(6);
            console.log("the state after update is:",await basicDemocracy.hasProposal());
            // await basicDemocracy.connect(basicDemocracy).update({from:basicDemocracy.address});
        });

        it("update a ModifyFundData proposal", async function () {
          await advanceTimeAndBlock(VOTE_DURATION*2);

          let reason:string = "Need mofify fund data";
          let detail:string = "it is time to mofify fund data";
          let sameManagers = [owner.address, alice.address];
          let diffManagers = [user.address, alice.address,bob.address,user.address];

          let newFunddataSameManager = {
            name: "88token",
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
                managers: sameManagers,
                numberOfNeedSignedAddresses: 2,
                managerFeeRatio: 100,
            },
        };

      await basicDemocracy.connect(alice)["toProposal(string,(string,address,uint256,uint256,uint256,uint256,(address,uint256,uint256,uint256,bool,uint256,uint256,uint256),(uint256,uint256,uint256),(address[],uint8,uint256)),string,string)"]
      ("ModifyFundData", newFunddataSameManager, reason,detail);

      // make the proposal state is 2
      let timeBlock = await latestBlock();
      console.log("timeBlock is:", timeBlock);
      await advanceBlockTo(timeBlock + VOTE_DURATION/2);
      let newtimeBlock = await latestBlock();
      console.log("newtimeBlock is:", newtimeBlock);

      let lastId = await basicDemocracy.lastID();
      let state = await basicDemocracy.getPropState(lastId);
      console.log("proposal state is :", state);
      let voteAmount = "100";
      await basicDemocracy.toVote(lastId,await withDecimals18(voteAmount));
      lastId = await basicDemocracy.lastID();
      let [_approved, _against, _voters] = await basicDemocracy.getVoteData(lastId);
      console.log("voteData is:", _approved.toString(), _against.toString(), _voters.toString());
      expect(_approved.toString()).to.be.equals(await withDecimals18(voteAmount));
      expect(_against.toString()).to.be.equals("0");
      expect(_voters.toString()).to.be.equals("1");
      // repeat a proposal
      await expect(basicDemocracy.toVote(lastId,await withDecimals18(voteAmount)))
          .revertedWith("Already vote the proposal!");
      await expect(basicDemocracy.connect(alice).toVote(lastId,await withDecimals18(voteAmount),{from:alice.address}))
      .to.be.revertedWith("amount == 0 or passed duration");

      await basicDemocracy.connect(user).toVote(lastId,await withDecimals18(voteAmount),{from:user.address});
      lastId = await basicDemocracy.lastID();
      [_approved, _against, _voters] = await basicDemocracy.getVoteData(lastId);
      expect(_approved.toString()).to.be.equals(await withDecimals18((parseInt(voteAmount)*2).toString()));
      expect(_against.toString()).to.be.equals("0");
      expect(_voters.toString()).to.be.equals("2");
      let negativeVoteAmount = "-100"
      await basicDemocracy.connect(bob).toVote(lastId,await withDecimals18(negativeVoteAmount));
      lastId = await basicDemocracy.lastID();
      [_approved, _against, _voters] = await basicDemocracy.getVoteData(lastId);
      expect(_approved.toString()).to.be.equals(await withDecimals18((parseInt(voteAmount)*2).toString()));
      expect(_against.toString()).to.be.equals(await withDecimals18(voteAmount));
      expect(_voters.toString()).to.be.equals("3");
      expect(await basicDemocracy.getVoteResult(lastId)).to.be.equals(0);
      basicDemocracy.connect(adminUser).toVote(lastId,await withDecimals18((parseInt(voteAmount)*3).toString()));
      await advanceBlockTo(timeBlock + VOTE_DURATION);
      expect(await basicDemocracy.getPropState(lastId)).to.be.equals(5);
      expect(await basicDemocracy.getVoteResult(lastId)).to.be.equals(1);

      await fund.setStatus(3);//3 == CLOSED
      await basicDemocracy.update(lastId);

      let curStatus = await fund.status();
      expect(curStatus).to.equals(3);
      console.log("the state after update is:",await basicDemocracy.hasProposal());
    });

    describe("execute proposal and batch update", function () {
      it("batch update a FundLiquidation proposal and a ModifyFundData proposal", async function () {
          // 1 vote to FundLiquidation proposal
          let timeBlock = await latestBlock();
          await advanceBlockTo(timeBlock + VOTE_DURATION/2);
          let newtimeBlock = await latestBlock();

          let lastId = await basicDemocracy.lastID();
          let state = await basicDemocracy.getPropState(lastId);
          console.log("proposal state is :", state);
          let voteAmount = "100";
          await basicDemocracy.toVote(lastId,await withDecimals18(voteAmount));
          lastId = await basicDemocracy.lastID();
          let [_approved, _against, _voters] = await basicDemocracy.getVoteData(lastId);

          await basicDemocracy.connect(user).toVote(lastId,await withDecimals18(voteAmount),{from:user.address});
          lastId = await basicDemocracy.lastID();
          [_approved, _against, _voters] = await basicDemocracy.getVoteData(lastId);
          
          let negativeVoteAmount = "-100"
          await basicDemocracy.connect(bob).toVote(lastId,await withDecimals18(negativeVoteAmount));
          lastId = await basicDemocracy.lastID();
          [_approved, _against, _voters] = await basicDemocracy.getVoteData(lastId);
          
          basicDemocracy.connect(adminUser).toVote(lastId,await withDecimals18((parseInt(voteAmount)*3).toString()));

          // 2  vote to ModifyFundData proposal
          let reason:string = "Need mofify fund data";
          let detail:string = "it is time to mofify fund data";
          let sameManagers = [owner.address, alice.address];
          let diffManagers = [user.address, alice.address,bob.address,user.address];

          let newFunddataDiffManager = {
            name: "88token",
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
                managers: diffManagers,
                numberOfNeedSignedAddresses: 2,
                managerFeeRatio: 100,
            },
        };
        await basicDemocracy.connect(signers[7])["toProposal(string,(string,address,uint256,uint256,uint256,uint256,(address,uint256,uint256,uint256,bool,uint256,uint256,uint256),(uint256,uint256,uint256),(address[],uint8,uint256)),string,string)"]
        ("ModifyFundData", newFunddataDiffManager, reason,detail);

        // make the proposal state is 2
        timeBlock = await latestBlock();
        await advanceBlockTo(timeBlock + VOTE_DURATION/2);

        newtimeBlock = await latestBlock();

        lastId = await basicDemocracy.lastID();
        state = await basicDemocracy.getPropState(lastId);
        voteAmount = "100";
        await basicDemocracy.connect(signers[8]).toVote(lastId,await withDecimals18(voteAmount));
        lastId = await basicDemocracy.lastID();
        [_approved, _against, _voters] = await basicDemocracy.getVoteData(lastId);

        await basicDemocracy.connect(signers[9]).toVote(lastId,await withDecimals18(voteAmount));
        lastId = await basicDemocracy.lastID();
        [_approved, _against, _voters] = await basicDemocracy.getVoteData(lastId);
        
        negativeVoteAmount = "-100"
        await basicDemocracy.connect(signers[10]).toVote(lastId,await withDecimals18(negativeVoteAmount));
        lastId = await basicDemocracy.lastID();
        [_approved, _against, _voters] = await basicDemocracy.getVoteData(lastId);
        
        basicDemocracy.connect(signers[11]).toVote(lastId,await withDecimals18((parseInt(voteAmount)*3).toString()));
        await advanceBlockTo(timeBlock + VOTE_DURATION);

        await fund.setStatus(3);//3 == CLOSED
        
        await basicDemocracy.batchUpdate([2,1]);

        let curStatus = await fund.status();
        expect(curStatus).to.equals(6);
        console.log("the state after update is:",await basicDemocracy.hasProposal());


      });

    });

  })

});

});
