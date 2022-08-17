import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { FundFactory, InvestPolicyTemplate, MockToken, OracleV3 } from "../typechain";
import { Fund, UserHistory, MultiSigWallet, InvestPolicy} from "../typechain";
import { advanceTimeAndBlock, latestTime } from "./utilities/time";

const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
async function withDecimals18(amount: number) {
  return BigNumber.from(amount).mul(BigNumber.from(10).pow(18)).toString();
}

describe("FundFactory contract test", function () {

    let fund: Fund;
    let fundFactory: FundFactory;
    let investPoli_Template: InvestPolicyTemplate;
    let userHistory: UserHistory;
    let multiSigWallet: MultiSigWallet;
    let usdc: MockToken;
    let investPoli_: InvestPolicy;
    let oracle: OracleV3;

    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let addrs: SignerWithAddress[];

    type fData = {
        name: string;
        investPolicy: string;
        closedPeriod: number;
        redemptionPeriod: number;
        minOpenInterest: number;
        sponsorDivideRatio: number;
        raiseData: {
          raiseToken: string;
          targetRaiseShare: number;
          initialNetValue: number;
          minRaiseShare: number;
          isHardTop: boolean;
          raisePeriod: number;
          minSharePurchase: number;
          maxSharePurchase: number;
        };
        bonusData: {
          bonusPeriod: number;
          bonusRatio: number;
          managerBonusDivideRatio: number;
        };
        manageData: {
          managers: string[];
          numberOfNeedSignedAddresses: number;
          managerFeeRatio: number;
        };
    };
    let _fundData: fData;
    beforeEach(async () => {
        [owner, alice, bob, ...addrs] = await ethers.getSigners();

        const Fund = await ethers.getContractFactory("Fund", owner);
        fund = await Fund.deploy();
        await fund.deployed();

        const FundFactory = await ethers.getContractFactory("FundFactory", owner);
        fundFactory = await FundFactory.deploy();
        await fundFactory.deployed();

        const InvestPolicyTemplate = await ethers.getContractFactory("InvestPolicyTemplate", owner);
        investPoli_Template = await InvestPolicyTemplate.deploy();
        await investPoli_Template.deployed();

        const UserHistory = await ethers.getContractFactory("UserHistory", owner);
        userHistory = await UserHistory.deploy();
        await userHistory.deployed();

        const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet", owner);
        multiSigWallet = await MultiSigWallet.deploy();
        await multiSigWallet.deployed();

        const MockToken = await ethers.getContractFactory("MockToken", owner);
        usdc = await MockToken.deploy("USD Coin", "USDC");
        await usdc.deployed();

        const OracleV3 = await ethers.getContractFactory("OracleV3", owner);
        oracle = await OracleV3.deploy();
        await oracle.deployed();

        const InvestPolicy = await ethers.getContractFactory("InvestPolicy", owner);
        investPoli_ = await InvestPolicy.deploy(
            [usdc.address],
            [usdc.address],
            usdc.address,
            investPoli_Template.address,
            "detail",
            fund.address,
            oracle.address
        );
        await investPoli_.deployed();

        await userHistory.initialize();
        await fundFactory.initialize(
            investPoli_Template.address,
            userHistory.address,
            multiSigWallet.address,
            oracle.address,
            owner.address
        );
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
    })

    it("initialize", async () => {
        expect(await fundFactory.owner()).to.equal(owner.address);
        expect(await fundFactory.policyTemplate()).to.equal(investPoli_Template.address);
        expect(await fundFactory.userHistory()).to.equal(userHistory.address);
        expect(await fundFactory.oracle()).to.equal(oracle.address);
        expect(await fundFactory.protocolFeeTo()).to.equal(owner.address);
        expect(await fundFactory.managerBonusDivideRatioLimit()).to.equal(2000);
        expect(await fundFactory.managerFeeRatioLimit()).to.equal(100);
        expect(await fundFactory.managersLimit()).to.equal(10);
    })

    describe("functions test", function () {
        it("setSalesFunds", async () => {
            // pre state
            let _fundNo = 1;
            await fundFactory.setInternal(owner.address, true);
            await fundFactory.createFund(_fundData, 0);

            // do call
            await fundFactory.setSalesFunds(_fundNo);
            await fundFactory.setSalesFunds(_fundNo);

            // check state variable
            expect(await fundFactory.salesFunds(0)).to.equal(_fundNo);
            expect(await fundFactory.salesFunds(1)).to.equal(_fundNo);
        })

        it("setSalesFunds failed", async () => {
            // Fund no exist
            await expect(fundFactory.setSalesFunds(1)).to.revertedWith("Fund not exist");
        })

        it("setUserInvestFunds", async () => {
            // pre state
            let _user = owner.address; let _fundNo = 1;
            await fundFactory.setInternal(owner.address, true);
            await fundFactory.createFund(_fundData, 0);

            // do call
            await fundFactory.setUserInvestFunds(_user, _fundNo);
            await fundFactory.setUserInvestFunds(_user, _fundNo);

            // check state variable
            expect(await fundFactory.userInvestFunds(_user, 0)).to.equal(_fundNo);
            expect(await fundFactory.userInvestFunds(_user, 1)).to.equal(_fundNo);
        })

        it("setUserInvestFunds failed", async () => {
            // Fund no exist
            await expect(fundFactory.setUserInvestFunds(owner.address, 1))
                .to.revertedWith("Fund not exist");
        })

        it("createFund", async () => {
            // pre state: fundNo == 0, fund.address == ADDRESS_ZERO
            let _fundNo = 0;
            expect(await fundFactory.fundNo()).to.equal(_fundNo);
            expect(await fundFactory.allFunds(1)).to.equal(ADDRESS_ZERO);

            _fundNo += 1;
            let tx = await fundFactory.createFund(_fundData, 0);
            // check state: fundNo == 1, fund.address != ADDRESS_ZERO
            expect(await fundFactory.fundNo()).to.equal(_fundNo);
            expect(await fundFactory.userCreateFunds(owner.address, 0)).to.equal(_fundNo);
            let eptFund = await fundFactory.allFunds(1);
            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("CreateFund");
            expect(eptEvent?.eventSignature)
                .to.equal("CreateFund(address,uint256,address)");
            let amounts = eptEvent?.args;
            expect(amounts?._user).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);
            expect(amounts?._fund).to.equal(eptFund);

            // _policyTempNo != 0
            _fundNo += 1;
            await investPoli_Template.createPolicyTemp("test", [usdc.address], [usdc.address]);
            tx = await fundFactory.createFund(_fundData, 1);
            expect(await fundFactory.fundNo()).to.equal(_fundNo);
            expect(await fundFactory.userCreateFunds(owner.address, 1)).to.equal(_fundNo);
            eptFund = await fundFactory.allFunds(2);
            // check event
            receipt = await tx.wait();
            eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("CreateFund");
            expect(eptEvent?.eventSignature)
                .to.equal("CreateFund(address,uint256,address)");
            amounts = eptEvent?.args;
            expect(amounts?._user).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);
            expect(amounts?._fund).to.equal(eptFund);
        })

        it("createFund failed", async() => {
            // sponsor divide ratio not match
            _fundData.sponsorDivideRatio = 10001;
            await expect(fundFactory.createFund(_fundData, 0))
                .to.revertedWith("Sponsor divide ratio greater than 10000");

            // minSharePurchase is greater than maxSharePurchase
            _fundData.sponsorDivideRatio = 10000;
            _fundData.raiseData.minSharePurchase = _fundData.raiseData.maxSharePurchase;
            await expect(fundFactory.createFund(_fundData, 0))
                .to.revertedWith("Min share equal to or greater than max share");

            // bonusRatio must less than 10000
            _fundData.raiseData.minSharePurchase = _fundData.raiseData.maxSharePurchase - 1;
            _fundData.bonusData.bonusRatio = 10001;
            await expect(fundFactory.createFund(_fundData, 0))
                .to.revertedWith("Bonus ratio greater than 10000");

            // managerBonusDivideRatio exceed limit
            _fundData.bonusData.bonusRatio = 10000;
            _fundData.bonusData.managerBonusDivideRatio = 2001;
            await expect(fundFactory.createFund(_fundData, 0))
                .to.revertedWith("Manager bonus divide ratio greater than limit");

            // manager fee ratio exceed limit
            _fundData.bonusData.managerBonusDivideRatio = 2000;
            _fundData.manageData.managerFeeRatio = 101;
            await expect(fundFactory.createFund(_fundData, 0))
                .to.revertedWith("Manager fee ratio greater than limit");

            // number of need signed addresses exceed limit
            _fundData.manageData.managerFeeRatio = 100;
            _fundData.manageData.numberOfNeedSignedAddresses = 4;
            await expect(fundFactory.createFund(_fundData, 0))
                .to.revertedWith("Number of need signed address greater than manager length");
        })

        it("resetProtocolFeeAddress", async () => {
            expect(await fundFactory.protocolFeeTo()).to.equal(owner.address);
            await fundFactory.resetProtocolFeeAddress(alice.address);
            expect(await fundFactory.protocolFeeTo()).to.equal(alice.address);
        })

        it("resetProtocolFeeAddress failed", async () => {
            await expect(fundFactory.connect(bob).resetProtocolFeeAddress(bob.address, {from:bob.address}))
                .to.revertedWith("Ownable: caller is not the owner");
        })

        it("resetManagerBonusDivideRatioLimit", async () => {
            expect(await fundFactory.managerBonusDivideRatioLimit()).to.equal(2000);
            await fundFactory.resetManagerBonusDivideRatioLimit(3000);
            expect(await fundFactory.managerBonusDivideRatioLimit()).to.equal(3000);
        })

        it("resetManagerBonusDivideRatioLimit failed", async () => {
            await expect(fundFactory.connect(bob).resetManagerBonusDivideRatioLimit(1, {from:bob.address}))
                .to.revertedWith("Ownable: caller is not the owner");
            await expect(fundFactory.resetManagerBonusDivideRatioLimit(5001))
                .to.revertedWith("Manager bonus divide ratio limit greater than 5000");
        })

        it("resetManagerFeeRatioLimit", async () => {
            expect(await fundFactory.managerFeeRatioLimit()).to.equal(100);
            await fundFactory.resetManagerFeeRatioLimit(300);
            expect(await fundFactory.managerFeeRatioLimit()).to.equal(300);
        })

        it("resetManagerFeeRatioLimit failed", async () => {
            await expect(fundFactory.connect(bob).resetManagerFeeRatioLimit(1, {from:bob.address}))
                .to.revertedWith("Ownable: caller is not the owner");
            await expect(fundFactory.resetManagerFeeRatioLimit(501))
                .to.revertedWith("Manager fee ratio limit greater than 500");
        })

        it("resetManagersLimit", async () => {
            expect(await fundFactory.managersLimit()).to.equal(10);
            await fundFactory.resetManagersLimit(30);
            expect(await fundFactory.managersLimit()).to.equal(30);
        })

        it("resetManagersLimit failed", async () => {
            await expect(fundFactory.connect(bob).resetManagersLimit(30, {from:bob.address}))
                .to.revertedWith("Ownable: caller is not the owner");
            await expect(fundFactory.resetManagersLimit(51))
                .to.revertedWith("Managers limit greater than 50");
        })
    })
})
