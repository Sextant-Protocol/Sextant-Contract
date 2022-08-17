import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { FundMock, FundFactory, InvestPolicyTemplate, FundShareToken } from "../typechain";
import { MockToken, UserHistory, MultiSigWallet, InvestPolicy, OracleV3 } from "../typechain";
import { advanceTimeAndBlock, latestTime } from "./utilities/time";

const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
async function withDecimals18(amount: number) {
  return BigNumber.from(amount).mul(BigNumber.from(10).pow(18)).toString();
}

describe("Fund contract test", function () {

    let fund: FundMock;
    let fundFactory: FundFactory;
    let investPoli_Template: InvestPolicyTemplate;
    let fundShareToken: FundShareToken;
    let usdc: MockToken;
    let usdt: MockToken;
    let userHistory: UserHistory;
    let multiSigWallet: MultiSigWallet;
    let investPoli_: InvestPolicy;
    let oracle: OracleV3;

    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let user: SignerWithAddress;
    let addrs: SignerWithAddress[];

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
        [owner, alice, bob, user, ...addrs] = await ethers.getSigners();

        const Fund = await ethers.getContractFactory("FundMock", owner);
        fund = await Fund.deploy();
        await fund.deployed();

        const FundFactory = await ethers.getContractFactory("FundFactory", owner);
        fundFactory = await FundFactory.deploy();
        await fundFactory.deployed();

        const InvestPolicyTemplate = await ethers.getContractFactory("InvestPolicyTemplate", owner);
        investPoli_Template = await InvestPolicyTemplate.deploy();
        await investPoli_Template.deployed();

        const FundShareToken = await ethers.getContractFactory("FundShareToken", owner);
        fundShareToken = await FundShareToken.deploy();
        await fundShareToken.deployed();

        const MockToken = await ethers.getContractFactory("MockToken", owner);
        usdc = await MockToken.deploy("USD Coin", "USDC");
        await usdc.deployed();
        usdt = await MockToken.deploy("USD Toin", "USDT");
        await usdt.deployed();

        const UserHistory = await ethers.getContractFactory("UserHistory", owner);
        userHistory = await UserHistory.deploy();
        await userHistory.deployed();

        const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet", owner);
        multiSigWallet = await MultiSigWallet.deploy();
        await multiSigWallet.deployed();

        const OracleV3 = await ethers.getContractFactory("OracleV3", owner);
        oracle = await OracleV3.deploy();
        await oracle.deployed();

        const InvestPolicy = await ethers.getContractFactory("InvestPolicy", owner);
        investPoli_ = await InvestPolicy.deploy(
            [usdt.address],
            [usdt.address],
            usdc.address,
            investPoli_Template.address,
            "detail",
            fund.address,
            oracle.address,
        );
        await investPoli_.deployed();

        await fundShareToken["initialize(string,string,address[],address)"]( "FundShareToken",
          "FST",
          [usdc.address],
          fund.address
        );
        await userHistory.initialize();
        await fundFactory.initialize(
            investPoli_Template.address,
            userHistory.address,
            multiSigWallet.address,
            oracle.address,
            owner.address
        );
        _fundNo = 1;
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
    })

    it("initialize", async () => {
        expect(await fund.owner()).to.equal(owner.address);
        expect(await fund.fundNo()).to.equal(1);
        expect(await fund.sponsor()).to.equal(owner.address);

        // check fundData
        let eptData = await fund.getFundData();
        expect(eptData.name).to.equal("66token");
        expect(eptData.investPolicy).to.equal(investPoli_.address);
        expect(eptData.closedPeriod).to.equal(20);
        expect(eptData.redemptionPeriod).to.equal(20);
        expect(eptData.minOpenInterest).to.equal(200);
        expect(eptData.sponsorDivideRatio).to.equal(2000);
        expect(eptData.raiseData.raiseToken).to.equal(usdc.address);
        expect(eptData.raiseData.targetRaiseShare).to.equal(20000);
        expect(eptData.raiseData.initialNetValue).to.equal(20);
        expect(eptData.raiseData.minRaiseShare).to.equal(200);
        expect(eptData.raiseData.isHardTop).to.equal(false);
        expect(eptData.raiseData.raisePeriod).to.equal(20);
        expect(eptData.raiseData.minSharePurchase).to.equal(200);
        expect(eptData.raiseData.maxSharePurchase).to.equal(5000);
        expect(eptData.bonusData.bonusPeriod).to.equal(20);
        expect(eptData.bonusData.bonusRatio).to.equal(2000);
        expect(eptData.bonusData.managerBonusDivideRatio).to.equal(2000);
        expect(eptData.manageData.managers[0]).to.equal(owner.address);
        expect(eptData.manageData.managers[1]).to.equal(alice.address);
        expect(eptData.manageData.numberOfNeedSignedAddresses).to.equal(2);
        expect(eptData.manageData.managerFeeRatio).to.equal(100);

        expect(await fund.factory()).to.equal(fundFactory.address);
        expect(await fund.fundShareToken()).to.equal(fundShareToken.address);
        expect(await fund.investPolicy()).to.equal(investPoli_.address);
        expect(await fund.userHistory()).to.equal(userHistory.address);
        expect(await fund.multiSigWallet()).to.equal(multiSigWallet.address);
        expect(await fund.status()).to.equal(0);
    })

    describe("functions test", function () {
        it("resetFundData", async () => {
            _fundData.name = "77token";
            _fundData.closedPeriod = 10;
            _fundData.raiseData.raiseToken = usdt.address;
            _fundData.raiseData.isHardTop= true;
            _fundData.raiseData.raisePeriod = 30;
            _fundData.bonusData.bonusPeriod = 60;
            _fundData.manageData.managers.push(bob.address);
            _fundData.manageData.numberOfNeedSignedAddresses = 3;
            await fund.resetFundData(_fundData);

            // check new data
            let eptData = await fund.getFundData();
            // changed params
            expect(eptData.name).to.equal("77token");
            expect(eptData.closedPeriod).to.equal(10);
            expect(eptData.raiseData.raiseToken).to.equal(usdt.address);
            expect(eptData.raiseData.isHardTop).to.equal(true);
            expect(eptData.raiseData.raisePeriod).to.equal(30);
            expect(eptData.bonusData.bonusPeriod).to.equal(60);
            expect(eptData.manageData.managers[2]).to.equal(bob.address);
            expect(eptData.manageData.numberOfNeedSignedAddresses).to.equal(3);
            // no change, same with `initialize`
            expect(eptData.investPolicy).to.equal(investPoli_.address);
            expect(eptData.redemptionPeriod).to.equal(20);
            expect(eptData.minOpenInterest).to.equal(200);
            expect(eptData.sponsorDivideRatio).to.equal(2000);
            expect(eptData.raiseData.targetRaiseShare).to.equal(20000);
            expect(eptData.raiseData.initialNetValue).to.equal(20);
            expect(eptData.raiseData.minRaiseShare).to.equal(200);
            expect(eptData.raiseData.minSharePurchase).to.equal(200);
            expect(eptData.raiseData.maxSharePurchase).to.equal(5000);
            expect(eptData.bonusData.bonusRatio).to.equal(2000);
            expect(eptData.bonusData.managerBonusDivideRatio).to.equal(2000);
            expect(eptData.manageData.managers[0]).to.equal(owner.address);
            expect(eptData.manageData.managers[1]).to.equal(alice.address);
            expect(eptData.manageData.managerFeeRatio).to.equal(100);
        })

        it("resetFundData failed", async () => {
            // caller must be owner
            await expect(fund.connect(bob).resetFundData(_fundData, {from:bob.address}))
                .to.revertedWith("Ownable: caller is not the owner");

            //  status is not match
            await fund.setStatus(1);
            await expect(fund.resetFundData(_fundData))
                .to.revertedWith("Fund is not in waiting for sale status");

            // sponsor divide ratio not match
            await fund.setStatus(0);
            _fundData.sponsorDivideRatio = 10001;
            await expect(fund.resetFundData(_fundData))
                .to.revertedWith("Sponsor divide ratio greater than 10000");

            // minSharePurchase is greater than maxSharePurchase
            _fundData.sponsorDivideRatio = 10000;
            _fundData.raiseData.minSharePurchase = _fundData.raiseData.maxSharePurchase;
            await expect(fund.resetFundData(_fundData))
                .to.revertedWith("Min share equal to or greater than max share");

            // bonusRatio must less than 10000
            _fundData.raiseData.minSharePurchase = _fundData.raiseData.maxSharePurchase - 1;
            _fundData.bonusData.bonusRatio = 10001;
            await expect(fund.resetFundData(_fundData))
                .to.revertedWith("Bonus ratio greater than 10000");

            // managerBonusDivideRatio exceed limit
            _fundData.bonusData.bonusRatio = 10000;
            _fundData.bonusData.managerBonusDivideRatio = 2001;
            await expect(fund.resetFundData(_fundData))
                .to.revertedWith("Manager bonus divide ratio greater than 2000");

            // manager fee ratio exceed limit
            _fundData.bonusData.managerBonusDivideRatio = 2000;
            _fundData.manageData.managerFeeRatio = 101;
            await expect(fund.resetFundData(_fundData))
                .to.revertedWith("Manager fee ratio greater than 100");

            // number of need signed addresses exceed limit
            _fundData.manageData.managerFeeRatio = 100;
            _fundData.manageData.numberOfNeedSignedAddresses = 4;
            await expect(fund.resetFundData(_fundData))
                .to.revertedWith("Number of need signed addresses greater than manager length");
        })

        it("startFundSales", async () => {
            // pre state (fundData.manageData.managers: [owner.address, alice.address])
            expect(await fund.isAdmin(owner.address)).to.equal(false);
            expect(await fund.isAdmin(alice.address)).to.equal(false);
            expect(await fund.status()).to.equal(0);

            // do call
            await fundFactory.setInternal(fund.address, true);
            await fundFactory.createFund(_fundData, 0);
            let tx = await fund.startFundSales();
            let _time = await latestTime();

            // check state variables (salesPeriodStartTime is excepted)
            expect(await fund.isAdmin(owner.address)).to.equal(true);
            expect(await fund.isAdmin(alice.address)).to.equal(true);
            expect(await fund.status()).to.equal(1);
            expect(await fund.salesPeriodStartTime()).to.equal(_time);


            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("StartFundSales");
            expect(eptEvent?.eventSignature)
                .to.equal("StartFundSales(address,uint256)");
            let amounts = eptEvent?.args;
            expect(amounts?._owner).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);
        })

        it("startFundSales failed", async () => {
            // not owner
            await fundFactory.setInternal(fund.address, true);
            await expect(fund.connect(bob).startFundSales({from:bob.address}))
                .to.revertedWith("Ownable: caller is not the owner");

            // status is not match
            await fund.setStatus(1);
            await expect(fund.startFundSales())
                .to.revertedWith("Fund is not in waiting for sale status");
        })

        it("closeFundSales", async () => {
            // pre state
            await fund.setAdmin(owner.address, true);
            expect(await fund.isManager(owner.address)).to.equal(true);

            // totalSalesShare >= targetRaiseShar
            await fund.setStatus(1); // ONSALE
            await fund.setTotalSalesShare(_fundData.raiseData.targetRaiseShare);
            // mint for fund.addres
            let usdc_amount = 2000;
            await usdc.mint(fund.address, usdc_amount);
            expect(await usdc.balanceOf(fund.address)).to.equal(usdc_amount);
            expect(await usdc.balanceOf(investPoli_.address)).to.equal(0);

            // do call
            let tx = await fund.closeFundSales();
            let _time = await latestTime();

            // check state
            expect(await fund.closedPeriodStartTime()).to.equal(_time);
            expect(await fund.lastBonusTime()).to.equal(_time);
            let _totalSalesShare = (await fund.totalSalesShare()).toNumber();
            let _totalInitialValue = _totalSalesShare * _fundData.raiseData.initialNetValue;
            let _lastBonusAfterNetValue = _fundData.raiseData.initialNetValue;
            expect(await fund.initialTotalValue()).to.equal(_totalInitialValue);
            expect(await fund.lastBonusAfterNetValue()).to.equal(_lastBonusAfterNetValue);
            expect(await fund.status()).to.equal(3);  // CLOSED
            expect(await usdc.balanceOf(fund.address)).to.equal(0);
            expect(await usdc.balanceOf(investPoli_.address)).to.equal(usdc_amount);
            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("StartFundClosed");
            expect(eptEvent?.eventSignature)
                .to.equal("StartFundClosed(address,uint256)");
            let amounts = eptEvent?.args;
            expect(amounts?._admin).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);



            // minRaiseShare <= totalSalesShare < targetRaiseShare
            // modify initialNetValue
            await fund.setStatus(0); // ONSALE
            _fundData.raiseData.initialNetValue = _fundData.raiseData.initialNetValue * 2;
            await fund.resetFundData(_fundData);
            let eptData = await fund.getFundData();
            await fund.setStatus(1); // ONSALE
            await fund.setTotalSalesShare(_fundData.raiseData.minRaiseShare);
            // mint for fund.address again
            let usdc_amount2 = 666;
            await usdc.mint(fund.address, usdc_amount2);
            expect(await usdc.balanceOf(fund.address)).to.equal(usdc_amount2);
            expect(await usdc.balanceOf(investPoli_.address)).to.equal(usdc_amount);

            // call again
            tx = await fund.closeFundSales();
            _time = await latestTime();

            // check state
            expect(await fund.closedPeriodStartTime()).to.equal(_time);
            expect(await fund.lastBonusTime()).to.equal(_time);
            _totalSalesShare = (await fund.totalSalesShare()).toNumber();
            _totalInitialValue = _totalSalesShare * _fundData.raiseData.initialNetValue;
            let _lastBonusAfterNetValue2 = _fundData.raiseData.initialNetValue;
            expect(_lastBonusAfterNetValue2).to.equal(_lastBonusAfterNetValue * 2);
            expect(await fund.initialTotalValue()).to.equal(_totalInitialValue);
            expect(await fund.lastBonusAfterNetValue()).to.equal(_lastBonusAfterNetValue2);
            expect(await fund.status()).to.equal(3);  // CLOSED
            expect(await usdc.balanceOf(fund.address)).to.equal(0);
            expect(await usdc.balanceOf(investPoli_.address)).to.equal(usdc_amount + usdc_amount2);
            // check event
            receipt = await tx.wait();
            eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("StartFundClosed");
            expect(eptEvent?.eventSignature)
                .to.equal("StartFundClosed(address,uint256)");
            amounts = eptEvent?.args;
            expect(amounts?._admin).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);



            // totalSalesShare < minRaiseShare
            await fund.setStatus(1); // ONSALE
            await fund.setTotalSalesShare(_fundData.raiseData.minRaiseShare - 1);
            // do call
            tx = await fund.closeFundSales();

            // check state
            expect(await fund.status()).to.equal(2);  // SALESFAILED
            _totalSalesShare = (await fund.totalSalesShare()).toNumber();
            expect(await fund.initialTotalValue()).to.equal(_totalSalesShare * _fundData.raiseData.initialNetValue);
            // check event
            receipt = await tx.wait();
            eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("FundSalesFailed");
            expect(eptEvent?.eventSignature)
                .to.equal("FundSalesFailed(address,uint256)");
            amounts = eptEvent?.args;
            expect(amounts?._admin).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);
        })

        it("closeFundSales failed", async () => {
            // not owner
            await expect(fund.connect(bob).closeFundSales({from:bob.address}))
                .to.revertedWith("caller is not admin");

            // status is not match
            await fund.setAdmin(owner.address, true);
            await expect(fund.closeFundSales()).to.revertedWith("Fund is not in on sale status");

            // fund in in the sales period
            await fund.setStatus(1); // ONSALE
            await fund.setTotalSalesShare(_fundData.raiseData.minRaiseShare);
            let _time = await latestTime();
            await fund.setSalesPeriodStartTime(_time);
            await expect(fund.closeFundSales()).to.revertedWith("Fund is in the sale period");
        })

        it("fundInvest TODO =========== not test", async () => {
            // // pre state
            // await fund.setStatus(3); // CLOSED
            // await fund.setAdmin(owner.address, true);
            // let _defi = usdc.address; let _params = "0x00"; let _token = usdt.address; let _hasHarvest = false;
            //
            // // multiSigWallet branch is not tested
            // // await fund.fundInvest(_defi, _params, _token, _hasHarvest);
            //
            // // _fundInvest branch test
            // await fund.setStatus(0); // ONSALE
            // _fundData.manageData.numberOfNeedSignedAddresses = 1;
            // await fund.resetFundData(_fundData);
            // await fund.setStatus(3); // CLOSED
            // await fund.fundInvest(_defi, _params, _token, _hasHarvest);
        })

        it("fundInvest failed", async () => {
            // not admin
            await expect(fund.fundInvest(usdc.address, "0x0000", usdt.address, false))
                .to.revertedWith("caller is not admin");

            // status is not match
            await fund.setAdmin(owner.address, true);
            await expect(fund.fundInvest(usdc.address, "0x0000", usdt.address, false))
                .to.revertedWith("Fund is not in closed status");
        })

        it("executeFundInvest TODO =========== not test", async () => {
        })

        it("executeFundInvest failed", async () => {
            // status is not match
            await expect(fund.executeFundInvest(usdc.address, "0x0000", usdt.address, false))
                .to.revertedWith("Fund is not in closed status");

            // caller in not multiSigWallet
            await fund.setStatus(3);  // CLOSED
            await expect(fund.executeFundInvest(usdc.address, "0x0000", usdt.address, false))
                .to.revertedWith("Only multi sig wallet call");
        })

        it("fundBouns", async () => {
            await fund.setStatus(3);  // CLOSED
            // mint for investPoli_.address
            let _totalValue = 1000040;
            await usdc.mint(investPoli_.address, _totalValue);

            let _time = (await latestTime()).toNumber();
            await fund.setClosedPeriodStartTime(_time - _fundData.closedPeriod); // uint day; in getManageFee() will be 1
            await fund.setTotalSalesShare(_fundData.raiseData.targetRaiseShare); // 20000
            expect(await fund.totalSalesShare()).to.equal(_fundData.raiseData.targetRaiseShare);
            expect(await fund.lastBonusAfterNetValue()).to.equal(0);

            // do call
            // fundShareToken totalSupply must not be zero
            await fundShareToken.mint(alice.address, 100);
            let tx = await fund.fundBonus();
            let _time2 = await latestTime();
            // getManageFee() will return: 20000 * 20 * 100 * 1 / 1000000 = 40
            // bonusOperation():
                // netValueDiff = (1000040 - 40) / 20000 - 0 = 50
                // totalValueIncrease = 50 * 20000 = 1000000
                // _protocolFee = 1000000 / 100 = 10000
                // _fundTotalBonusAmount = (1000000 - 10000) * 2000 / 10000 = 198000
                // investPoli_.withdraw(208000): investPoli_ transfer 208000 to fund
            // transferProtocolFeeAndBonus():
                // safeTransfer(owner, _protocolFee): fund transfer 10000 to owner
                // managersBonusAmount: 198000 * 2000 / 10000 = 39600
                // sponsorBonusAmount: 39600 * 2000 / 10000 = 7920
                // managerBonusAmount(single): (39600 - 7920) / 1 = 31680
                // safeTransfer(owner, sponsorBonusAmount): fund transfer 7920 to owner
                // safeTransfer(alice, managerBonusAmount): fund transfer 31680 to alice
                // usersBonusAmount: 198000 - 39600 = 158400
                // offerBonus(transfer): fund transfer 158400 to fundShareToken

            // check balance
            expect(await usdc.balanceOf(fund.address)).to.equal(0);
            expect(await usdc.balanceOf(owner.address)).to.equal(17920);
            expect(await usdc.balanceOf(alice.address)).to.equal(31680);
            expect(await usdc.balanceOf(fundShareToken.address)).to.equal(158400);
            expect(await usdc.balanceOf(investPoli_.address)).to.equal(1000040 - 208000);
            // check state variables
            // lastBonusAfterNetValue: (1000040 - 40 - 10000 - 198000) / 20000 = 39 (39.6)
            // totalUsersBonusAmount: 0 + 158400 = 158400
            expect(await fund.lastBonusTime()).to.equal(_time2);
            expect(await fund.lastBonusAfterNetValue()).to.equal(39);
            expect(await fund.totalUsersBonusAmount()).to.equal(158400);
            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("FundBouns");
            expect(eptEvent?.eventSignature)
                .to.equal("FundBouns(address,uint256,uint256,uint256,uint256)");
            let amounts = eptEvent?.args;
            expect(amounts?._user).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);
            expect(amounts?._protocolFee).to.equal(10000);
            expect(amounts?._managersBonusAmount).to.equal(39600);
            expect(amounts?._usersBonusAmount).to.equal(158400);
        })

        it("fundBouns failed", async () => {
            // status is not match
            await expect(fund.fundBonus()).to.revertedWith("Fund is not in closed status");

            // not in bonusPeriod
            await fund.setStatus(3);  // CLOSED
            let _time = await latestTime();
            await fund.setLastBonusTime(_time);
            await expect(fund.fundBonus()).to.revertedWith("Fund is not reched next bonus time");

            // No profit
            await fund.setLastBonusTime(0);
            let _totalValue = 40;
            await usdc.mint(investPoli_.address, _totalValue);
            let _time2 = (await latestTime()).toNumber();
            await fund.setClosedPeriodStartTime(_time2 - _fundData.closedPeriod); // uint day; in getManageFee() will be 1
            await fund.setTotalSalesShare(_fundData.raiseData.targetRaiseShare); // 20000
            await expect(fund.fundBonus()).to.revertedWith("No profit in this period, no bonus");
        })

        it("updateHistoryData TODO ======= not test (oracle not initialized)", async () => {
            // swapTokens: [usdc, usdt], localToken: usdc
            let _usdcAmount = 100040; let _usdtAmount = 2000;
            await usdc.mint(investPoli_.address, _usdcAmount);
            await usdt.mint(investPoli_.address, _usdtAmount);
            let _time = (await latestTime()).toNumber();
            await fund.setClosedPeriodStartTime(_time - _fundData.closedPeriod); // uint day; in getManageFee() will be 1

            // set swapFeeV3
            // let _token0s = [usdc.address, usdt.address]; let _token1s = [usdc.address, usdc.address]; let _swapFees = [1, 10];
            // await investPoli_Template.setSwapFeeV3(_token0s, _token1s, _swapFees);
            let info = await investPoli_.totalValue();
            // let info = await fund.updateHistoryData();
            // console.log(info);
        })

        it("startFundSettlement", async () => {
            // pre state
            await fund.setAdmin(owner.address, true);
            await fund.setStatus(3); // CLOSED

            // do call
            let tx = await fund.startFundSettlement();

            // check state variables
            expect(await fund.status()).to.equal(4); // SETTLEMENT
            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("StartFundSettlement");
            expect(eptEvent?.eventSignature)
                .to.equal("StartFundSettlement(address,uint256)");
            let amounts = eptEvent?.args;
            expect(amounts?._admin).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);
        })

        it("startFundSettlement failed", async () => {
            // not admin
            await expect(fund.startFundSettlement()).to.revertedWith("caller is not admin");

            // status not match
            await fund.setAdmin(owner.address, true);
            await expect(fund.startFundSettlement()).to.revertedWith("Fund is not in closed status");

            // still in close period
            await fund.setStatus(3);  // CLOSED
            let _time = await latestTime();
            await fund.setClosedPeriodStartTime(_time);
            await expect(fund.startFundSettlement()).to.revertedWith("Fund is in the closed period");
        })

        it("startFundLiquidation", async () => {
            // pre state
            await fund.setInternal(owner.address, true);
            await fund.setStatus(3); // CLOSED

            // do call
            let tx = await fund.startFundLiquidation();

            // check state variables
            expect(await fund.status()).to.equal(6); // LIQUIDATION
            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("StartFundLiquidation");
            expect(eptEvent?.eventSignature)
                .to.equal("StartFundLiquidation(uint256)");
            let amounts = eptEvent?.args;
            expect(amounts?._fundNo).to.equal(_fundNo);
        })

        it("startFundLiquidation failed", async () => {
            // not internal
            await expect(fund.startFundLiquidation()).to.revertedWith("caller is not internal caller");

            // status is not match
            await fund.setInternal(owner.address, true);
            await expect(fund.startFundLiquidation()).to.revertedWith("Fund is not in closed status");
        })

        it("modifyFundData", async () => {
            // set pre state
            await fund.setInternal(owner.address, true);
            await fund.setStatus(3);  // CLOSED

            _fundData.name = "77token";
            _fundData.closedPeriod = 10;
            _fundData.raiseData.raiseToken = usdt.address;
            _fundData.raiseData.isHardTop= true;
            _fundData.raiseData.raisePeriod = 30;
            _fundData.bonusData.bonusPeriod = 60;
            _fundData.manageData.managers.push(bob.address);
            _fundData.manageData.numberOfNeedSignedAddresses = 3;
            expect(await fund.getLengthOfManagers()).to.equal(2);
            await fund.modifyFundData(_fundData, false);
            expect(await fund.getLengthOfManagers()).to.equal(3);

            // check new data
            let eptData = await fund.getFundData();
            // changed params
            expect(eptData.name).to.equal("77token");
            expect(eptData.closedPeriod).to.equal(10);
            expect(eptData.raiseData.raiseToken).to.equal(usdt.address);
            expect(eptData.raiseData.isHardTop).to.equal(true);
            expect(eptData.raiseData.raisePeriod).to.equal(30);
            expect(eptData.bonusData.bonusPeriod).to.equal(60);
            expect(eptData.manageData.managers[2]).to.equal(bob.address);
            expect(eptData.manageData.numberOfNeedSignedAddresses).to.equal(3);
            // no change, same with `initialize`
            expect(eptData.investPolicy).to.equal(investPoli_.address);
            expect(eptData.redemptionPeriod).to.equal(20);
            expect(eptData.minOpenInterest).to.equal(200);
            expect(eptData.sponsorDivideRatio).to.equal(2000);
            expect(eptData.raiseData.targetRaiseShare).to.equal(20000);
            expect(eptData.raiseData.initialNetValue).to.equal(20);
            expect(eptData.raiseData.minRaiseShare).to.equal(200);
            expect(eptData.raiseData.minSharePurchase).to.equal(200);
            expect(eptData.raiseData.maxSharePurchase).to.equal(5000);
            expect(eptData.bonusData.bonusRatio).to.equal(2000);
            expect(eptData.bonusData.managerBonusDivideRatio).to.equal(2000);
            expect(eptData.manageData.managers[0]).to.equal(owner.address);
            expect(eptData.manageData.managers[1]).to.equal(alice.address);
            expect(eptData.manageData.managerFeeRatio).to.equal(100);

            expect(await fund.isManager(owner.address)).to.equal(false)
            expect(await fund.isManager(alice.address)).to.equal(false)
            expect(await fund.isManager(bob.address)).to.equal(false)
            // modify again
            await fund.modifyFundData(_fundData, true);
            expect(await fund.isManager(owner.address)).to.equal(true)
            expect(await fund.isManager(alice.address)).to.equal(true)
            expect(await fund.isManager(bob.address)).to.equal(true)
        })

        it("modifyFundData failed", async () => {
            // not internal
            await expect(fund.modifyFundData(_fundData, true)).to.revertedWith("caller is not internal caller");

            // status is not match
            await fund.setInternal(owner.address, true);
            await expect(fund.modifyFundData(_fundData, true)).to.revertedWith("Fund is not in closed status");
        })

        it("changeInvestPolicy", async () => {
            await fund.setStatus(3); // CLOSED
            await fund.setInternal(owner.address, true);

            await fund.changeInvestPolicy(usdt.address);

            expect(await fund.isChangeInvestPolicy()).to.equal(true);
            expect(await fund.newInvestPolicy()).to.equal(usdt.address);
        })

        it("changeInvestPolicy failed", async () => {
            // not internal
            await expect(fund.changeInvestPolicy(usdt.address)).to.revertedWith("caller is not internal caller");

            // status is not match
            await fund.setInternal(owner.address, true);
            await expect(fund.changeInvestPolicy(usdt.address)).to.revertedWith("Fund is not in closed status");
        })

        it("changeNumberOfNeedSignedAddresses", async () => {
            await fund.setStatus(3);  // CLOSED
            await fund.setInternal(owner.address, true);

            let _num = 66;
            await fund.changeNumberOfNeedSignedAddresses(_num);
            expect(await fund.getNumberOfNeedSignedAddresses()).to.equal(_num);
        })

        it("changeNumberOfNeedSignedAddresses failed", async () => {
            // not internal
            await expect(fund.changeNumberOfNeedSignedAddresses(1)).to.revertedWith("caller is not internal caller");

            // status is not match
            await fund.setInternal(owner.address, true);
            await expect(fund.changeNumberOfNeedSignedAddresses(1)).to.revertedWith("Fund is not in closed status");
        })

        it("settlement TODO ======= not test", async () => {
            // calldata _params
        })

        it("fundSettlement TODO ======= test failed", async () => {
            // pre state
            await fund.setStatus(4);
            // mint for investPoli_.address
            let _totalValue = 1000040;
            await usdc.mint(investPoli_.address, _totalValue);  // usdc is localToken
            await usdt.mint(investPoli_.address, _totalValue);  // usdc is localToken

            // totalValue: 1000040, unswapTokens: [usdt], balance: [0]
            // await fund.fundSettlement();
        })

        it("fundContinuation", async () => {
            // pre state
            await fund.setAdmin(owner.address, true);

            // totalSalesShare >= targetRaiseShar
            await fund.setStatus(5); // REDEMPTION
            await fund.setTotalSalesShare(_fundData.raiseData.targetRaiseShare);
            await fund.setRedemptionNetValue(5);
            // mint for fund.addres
            let usdc_amount = 2000;
            await usdc.mint(fund.address, usdc_amount);
            expect(await usdc.balanceOf(fund.address)).to.equal(usdc_amount);
            expect(await usdc.balanceOf(investPoli_.address)).to.equal(0);

            // do call
            let tx = await fund.fundContinuation();
            let _time = await latestTime();

            // check state
            expect(await fund.closedPeriodStartTime()).to.equal(_time);
            expect(await fund.lastBonusTime()).to.equal(_time);
            let _totalSalesShare = (await fund.totalSalesShare()).toNumber();
            let _redemptionNetValue = (await fund.redemptionNetValue()).toNumber();
            let _totalInitialValue = _totalSalesShare * _redemptionNetValue; // 20000 * 5
            let _lastBonusAfterNetValue = _redemptionNetValue;
            expect(await fund.initialTotalValue()).to.equal(_totalInitialValue);
            expect(await fund.lastBonusAfterNetValue()).to.equal(_lastBonusAfterNetValue);
            expect(await fund.status()).to.equal(3);  // CLOSED
            expect(await usdc.balanceOf(fund.address)).to.equal(0);
            expect(await usdc.balanceOf(investPoli_.address)).to.equal(usdc_amount);
            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("FundContinuation");
            expect(eptEvent?.eventSignature)
                .to.equal("FundContinuation(address,uint256)");
            let amounts = eptEvent?.args;
            expect(amounts?._admin).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);

            eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("StartFundClosed");
            expect(eptEvent?.eventSignature)
                .to.equal("StartFundClosed(address,uint256)");
            amounts = eptEvent?.args;
            expect(amounts?._admin).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);

            // set isChangeInvestPolicy: true
            await fund.setStatus(3); // CLOSED
            await fund.setInternal(owner.address, true);
            await fund.changeInvestPolicy(usdt.address);
            expect(await fund.isChangeInvestPolicy()).to.equal(true);
            await fund.setStatus(5); // REDEMPTION
            tx = await fund.fundContinuation();
            _time = await latestTime();

            // check some state
            expect(await fund.closedPeriodStartTime()).to.equal(_time);
            expect(await fund.lastBonusTime()).to.equal(_time);
            let eptInfo = await fund.getFundData();
            expect(eptInfo.investPolicy).to.equal(usdt.address);
            expect(await fund.isChangeInvestPolicy()).to.equal(false);
            // check events
            receipt = await tx.wait();
            eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("FundContinuation");
            expect(eptEvent?.eventSignature)
                .to.equal("FundContinuation(address,uint256)");
            amounts = eptEvent?.args;
            expect(amounts?._admin).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);
        })

        it("fundContinuation failed", async () => {
            await fund.setAdmin(owner.address, true);
            // not in redemption status
            await expect(fund.fundContinuation())
                .to.revertedWith("Fund is not in redemption status or not perpetual");

            // redemption period
            await fund.setStatus(5); // REDEMPTION
            let _time = await latestTime();
            await fund.setRedemptionPeriodStartTime(_time);
            await expect(fund.fundContinuation())
                .to.revertedWith("Fund is in the redemption period");

            //  not in perpetual
            await fund.setStatus(0); // REDEMPTION
            _fundData.redemptionPeriod = 0;
            await fund.resetFundData(_fundData);
            await fund.setStatus(5); // REDEMPTION
            await expect(fund.fundContinuation())
                .to.revertedWith("Fund is not in redemption status or not perpetual");
        })

        it("buyFund", async () => {
            await fund.setStatus(1);  // ONSALE
            await fundFactory.setInternal(fund.address, true);
            await fundFactory.createFund(_fundData, 0);
            await userHistory.setInternalCaller(fund.address, true);

            let _share = 1000;
            let tx = await fund.buyFund(_share);

            expect(await fund.totalSalesShare()).to.equal(_share)
            expect(await fund.userShare(owner.address)).to.equal(_share)
            expect(await fundFactory.userInvestFunds(owner.address, 0)).to.equal(_fundNo);
            expect(await fundShareToken.balanceOf(owner.address)).to.equal(_share);
            // check userHistoryTokenInfo
            let tokenInfo = await userHistory.getUserHistoryTokenInfo(owner.address, 0);
            let _initialNetValue = _fundData.raiseData.initialNetValue;
            expect(tokenInfo[0].token).to.equal(usdc.address);
            expect(tokenInfo[0].amount).to.equal(_share * _initialNetValue);
            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("BuyFund");
            expect(eptEvent?.eventSignature)
                .to.equal("BuyFund(address,uint256,uint256)");
            let amounts = eptEvent?.args;
            expect(amounts?._user).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);
            expect(amounts?._share).to.equal(_share);

            // call again
            await fund.setStatus(5) // REDEMPTION
            let _share2 = 666;
            await fund.setRedemptionNetValue(10);
            tx = await fund.buyFund(_share2);

            expect(await fund.totalSalesShare()).to.equal(_share + _share2);
            expect(await fund.userShare(owner.address)).to.equal(_share + _share2)
            expect(await fundFactory.userInvestFunds(owner.address, 1)).to.equal(_fundNo);
            expect(await fundShareToken.balanceOf(owner.address)).to.equal(_share + _share2);
            // check userHistoryTokenInfo
            tokenInfo = await userHistory.getUserHistoryTokenInfo(owner.address, 1);
            let _redemptionNetValue = (await fund.redemptionNetValue()).toNumber();
            expect(tokenInfo[0].token).to.equal(usdc.address);
            expect(tokenInfo[0].amount).to.equal(_share2 * _redemptionNetValue);
            // check event
            receipt = await tx.wait();
            eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("BuyFund");
            expect(eptEvent?.eventSignature)
                .to.equal("BuyFund(address,uint256,uint256)");
            amounts = eptEvent?.args;
            expect(amounts?._user).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);
            expect(amounts?._share).to.equal(_share2);
        })

        it("buyFund failed", async () => {
            // not on sale || not perpetual
            _fundData.redemptionPeriod = 0;
            await fund.resetFundData(_fundData);
            await fund.setStatus(5); // REDEMPTION
            await expect(fund.buyFund(66))
                .to.revertedWith("Fund is not in on sale or redemption status or not perpetual");

            // the amount to buy is too large
            await fund.setStatus(1); // ONSALE
            await expect(fund.buyFund(10000))
                .to.revertedWith("Buy share number greater than the max share");

            // the amount to buy too small
            await expect(fund.buyFund(100))
                .to.revertedWith("Buy share number less than the min share");
            await fund.setStatus(0);
            _fundData.redemptionPeriod = 20;
            _fundData.raiseData.isHardTop = true;
            await fund.resetFundData(_fundData);
            await fund.setStatus(5); // REDEMPTION
            await expect(fund.buyFund(100))
                .to.revertedWith("Buy share number less than the min share");

            // the amount to buy should equal remainShare
            await fund.setTotalSalesShare(_fundData.raiseData.targetRaiseShare - _fundData.raiseData.minSharePurchase + 1);
            await expect(fund.buyFund(100))
                .to.revertedWith("Buy share not equal to remain share");
        })

        it("redemptionAll(status: SALESFAILED)", async () => {
            await fund.setStatus(5); // REDEMPTION
            await fundFactory.setInternal(fund.address, true);
            await fundFactory.createFund(_fundData, 0);
            await userHistory.setInternalCaller(fund.address, true);
            await usdc.mint(fund.address, 6000);

            let _share1 = 1000; let _share2 = 4000;
            // approve
            await fundShareToken.approve(fund.address, _share1);
            await fund.buyFund(_share1);
            await fund.connect(bob).buyFund(_share2, {from:bob.address});
            // totalSupply: 5000
            // userBalance: 1000
            // ratio: 2000
            await fund.setInitialTotalValue(1000);
            // amount: 200
            await fund.setTotalSalesShare(2000);
            // totalSalesShare: 2000

            // set status to SALESFAILED
            await fund.setStatus(2); // SALESFAILED
            let tx = await fund.redemptionAll();
            expect(await usdc.balanceOf(fund.address)).to.equal(5800);
            expect(await usdc.balanceOf(owner.address)).to.equal(200);
            expect(await fund.totalSalesShare()).to.equal(1000);
            expect(await fund.userShare(owner.address)).to.equal(0);
            expect(await fundShareToken.balanceOf(owner.address)).to.equal(0);
            // check userHistoryTokenInfo, index is 1( buyFund has writen History for owner once)
            let tokenInfo = await userHistory.getUserHistoryTokenInfo(owner.address, 1);
            expect(tokenInfo[0].token).to.equal(usdc.address);
            expect(tokenInfo[0].amount).to.equal(200);
            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("RedemptionFund");
            expect(eptEvent?.eventSignature)
                .to.equal("RedemptionFund(address,uint256,uint256)");
            let amounts = eptEvent?.args;
            expect(amounts?._user).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);
            expect(amounts?._amount).to.equal(200);
        })

        it("redemptionAll(status: not SALESFAILED)", async () => {
            await fund.setStatus(5); // REDEMPTION
            await fundFactory.setInternal(fund.address, true);
            await fundFactory.createFund(_fundData, 0);
            await userHistory.setInternalCaller(fund.address, true);
            await usdc.mint(fund.address, 6000);

            let _share1 = 1000; let _share2 = 4000;
            // approve
            await fundShareToken.approve(fund.address, _share1);
            await fund.buyFund(_share1);
            await fund.connect(bob).buyFund(_share2, {from:bob.address});
            // totalSupply: 5000
            // userBalance: 1000
            // ratio: 2000
            await fund.setRedemptionTotalValue(1000);
            // amount: 200
            await fund.setTotalSalesShare(2000);
            // totalSalesShare: 2000

            let tx = await fund.redemptionAll();
            expect(await usdc.balanceOf(fund.address)).to.equal(5800);
            expect(await usdc.balanceOf(owner.address)).to.equal(200);
            expect(await fund.totalSalesShare()).to.equal(1000);
            expect(await fund.userShare(owner.address)).to.equal(0);
            expect(await fundShareToken.balanceOf(owner.address)).to.equal(0);
            // check userHistoryTokenInfo, index is 1( buyFund has writen History for owner once)
            let tokenInfo = await userHistory.getUserHistoryTokenInfo(owner.address, 1);
            expect(tokenInfo[0].token).to.equal(usdc.address);
            expect(tokenInfo[0].amount).to.equal(200);
            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("RedemptionFund");
            expect(eptEvent?.eventSignature)
                .to.equal("RedemptionFund(address,uint256,uint256)");
            let amounts = eptEvent?.args;
            expect(amounts?._user).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);
            expect(amounts?._amount).to.equal(200);
        })

        it("redemptionAll failed", async() => {
            // five status: not match
            await expect(fund.redemptionAll())
                .to.revertedWith("Fund is not in sales failed or redemption or stop status");
            await fund.setStatus(1);
            await expect(fund.redemptionAll())
                .to.revertedWith("Fund is not in sales failed or redemption or stop status");
            await fund.setStatus(3);
            await expect(fund.redemptionAll())
                .to.revertedWith("Fund is not in sales failed or redemption or stop status");
            await fund.setStatus(4);
            await expect(fund.redemptionAll())
                .to.revertedWith("Fund is not in sales failed or redemption or stop status");
            await fund.setStatus(6);
            await expect(fund.redemptionAll())
                .to.revertedWith("Fund is not in sales failed or redemption or stop status");
        })

        it("redemptionByShare", async () => {
            await fund.setStatus(5); // REDEMPTION
            await fundFactory.setInternal(fund.address, true);
            await fundFactory.createFund(_fundData, 0);
            await userHistory.setInternalCaller(fund.address, true);
            await usdc.mint(fund.address, 6000);

            let _share = 600;
            let _share1 = 1000; let _share2 = 4000;
            // approve
            await fundShareToken.approve(fund.address, _share1);
            await fund.buyFund(_share1);
            await fund.connect(bob).buyFund(_share2, {from:bob.address});
            // totalSupply: 5000
            // userBalance: 1000
            // ratio: 1200
            await fund.setRedemptionTotalValue(1000);
            // amount: 120
            await fund.setTotalSalesShare(2000);
            // totalSalesShare: 2000

            let tx = await fund.redemptionByShare(_share);
            expect(await usdc.balanceOf(fund.address)).to.equal(5880);
            expect(await usdc.balanceOf(owner.address)).to.equal(120);
            expect(await fund.totalSalesShare()).to.equal(1400);
            expect(await fund.userShare(owner.address)).to.equal(400);
            expect(await fundShareToken.balanceOf(owner.address)).to.equal(400);
            // check userHistoryTokenInfo, index is 1( buyFund has writen History for owner once)
            let tokenInfo = await userHistory.getUserHistoryTokenInfo(owner.address, 1);
            expect(tokenInfo[0].token).to.equal(usdc.address);
            expect(tokenInfo[0].amount).to.equal(120);
            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("RedemptionFund");
            expect(eptEvent?.eventSignature)
                .to.equal("RedemptionFund(address,uint256,uint256)");
            let amounts = eptEvent?.args;
            expect(amounts?._user).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);
            expect(amounts?._amount).to.equal(120);
        })

        it("redemptionByShare failed", async () => {
            // not in redemption or not perpetual
            await expect(fund.redemptionByShare(100))
                .to.revertedWith("Fund is not in redemption status or not perpetual");

            // exceed user's share
            await fund.setStatus(5); // REDEMPTION
            await fundFactory.setInternal(fund.address, true);
            await fundFactory.createFund(_fundData, 0);
            await userHistory.setInternalCaller(fund.address, true);
            await fund.buyFund(1000);
            let _share = (await fund.getMyFundShare()).toNumber();
            await expect(fund.redemptionByShare(_share + 1))
                .to.revertedWith("Redemption share greater than user share");
        })

        it("withdrawFundBonus", async () => {
            await userHistory.setInternalCaller(fund.address, true);
            // do call
            let tx = await fund.withdrawFundBonus(); // token: usdc.address, amount: 0

            let tokenInfo = await userHistory.getUserHistoryTokenInfo(owner.address, 0);
            expect(tokenInfo[0].token).to.equal(usdc.address);
            expect(tokenInfo[0].amount).to.equal(0);
            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("WithdrawFundBonus");
            expect(eptEvent?.eventSignature)
                .to.equal("WithdrawFundBonus(address,uint256,address[],uint256[])");
            let amounts = eptEvent?.args;
            expect(amounts?._user).to.equal(owner.address);
            expect(amounts?._fundNo).to.equal(_fundNo);
            expect(amounts?._bonusTokens.length).to.equal(1);
            expect(amounts?._bonusTokens[0]).to.equal(usdc.address);
            expect(amounts?._bonusAmounts[0]).to.equal(0);
        })

        it("getMyFundBonus", async() => {
            let eptInfo = await fund.getMyFundBonus();
            expect(eptInfo[0].length).to.equal(1);
            expect(eptInfo[0][0]).to.equal(usdc.address);
            expect(eptInfo[1][0]).to.equal(0);
        })

        it("getFundNetValue", async() => {
            await fund.setStatus(3);  // CLOSED
            // mint for investPoli_.address
            let _totalValue = 100020;
            await usdc.mint(investPoli_.address, _totalValue);
            let _time = (await latestTime()).toNumber();
            await fund.setClosedPeriodStartTime(_time - _fundData.closedPeriod); // uint day; in getManageFee() will be 1
            await fund.setTotalSalesShare(10000);
            expect(await fund.getFundNetValue()).to.equal(10);

            await fund.setStatus(5);
            await fund.setRedemptionNetValue(66);
            expect(await fund.getFundNetValue()).to.equal(66);
        })

        it("getManagers", async () => {
            let _managers = await fund.getManagers();
            expect(_managers.length).to.equal(2);
            expect(_managers[0]).to.equal(owner.address);
            expect(_managers[1]).to.equal(alice.address);
        })
    })
})
// enum FundStatus {
//     WAITINGFORSALE,
//     ONSALE,
//     SALESFAILED,
//     CLOSED,
//     SETTLEMENT,
//     REDEMPTION,
//     LIQUIDATION,
//     STOP
// }
// _fundData = {
//     name: "66token",
//     investPolicy: investPoli_.address,
//     closedPeriod: 20,
//     redemptionPeriod: 20,
//     minOpenInterest: 200,
//     sponsorDivideRatio: 2000,
//     raiseData: {
//         raiseToken: usdc.address,
//         targetRaiseShare: 20000,
//         initialNetValue: 20,
//         minRaiseShare: 200,
//         isHardTop: false,
//         raisePeriod: 20,
//         minSharePurchase: 200,
//         maxSharePurchase: 5000,
//     },
//     bonusData: {
//         bonusPeriod: 20,
//         bonusRatio: 2000,
//         managerBonusDivideRatio: 2000,
//     },
//     manageData: {
//         managers: [owner.address, alice.address],
//         numberOfNeedSignedAddresses: 2,
//         managerFeeRatio: 100,
//     },
// };
