import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { InvestPolicyTemplateMock, MockToken } from "../typechain";
import { latestTime } from "./utilities/time";

const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
describe("InvestPolicyTemplate contract test", function () {

    let investPolicyTemp: InvestPolicyTemplateMock;
    let defi1: MockToken;
    let defi2: MockToken;
    let token1: MockToken;
    let token2: MockToken;
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let addrs: SignerWithAddress[];
    beforeEach(async () => {
        [owner, alice, bob, ...addrs] = await ethers.getSigners();
        const InvestPolicyTemp = await ethers.getContractFactory("InvestPolicyTemplateMock", owner);
        investPolicyTemp = await InvestPolicyTemp.deploy();
        await investPolicyTemp.deployed();

        const MockToken = await ethers.getContractFactory("MockToken", owner);
        defi1 = await MockToken.deploy("Defi1", "DF1");
        await defi1.deployed();
        defi2 = await MockToken.deploy("Defi2", "DF2");
        await defi2.deployed();
        token1 = await MockToken.deploy("Token1", "TK1");
        await token1.deployed();
        token2 = await MockToken.deploy("Token2", "TK2");
        await token2.deployed();
    })

    describe("functions test", function () {
        it("createPolicyTemp", async () => {
            let _detail = "testCreatePolicyTemplate";
            let _policyTempNo = (await investPolicyTemp.policyTempNo()).toNumber();
            expect(await investPolicyTemp.isFuncNamesOfInvestPolicy("invest")).to.equal(false);
            expect(await investPolicyTemp.isFuncNamesOfInvestPolicy("withdrawFromDefi")).to.equal(false);
            expect(await investPolicyTemp.isFuncNamesOfInvestPolicy("settle")).to.equal(false);
            expect(await investPolicyTemp.isFuncNamesOfInvestPolicy("withdraw")).to.equal(false);
            expect(await investPolicyTemp.isFuncNamesOfInvestPolicy("withdrawAfterSettle")).to.equal(false);
            // do call
            let tx = await investPolicyTemp.createPolicyTemp(_detail, [defi1.address, defi2.address], [token1.address]);

            // check state
            expect(await investPolicyTemp.policyTempNo()).to.equal(_policyTempNo + 1);
            let _policyTempInfo = await investPolicyTemp.policyTempInfo(_policyTempNo + 1);
            expect(_policyTempInfo[0]).to.equal(owner.address);
            expect(_policyTempInfo[1]).to.equal(_detail);
            expect(_policyTempInfo[2].length).to.equal(2);
            expect(_policyTempInfo[2][0]).to.equal(defi1.address);
            expect(_policyTempInfo[2][1]).to.equal(defi2.address);
            expect(_policyTempInfo[3].length).to.equal(1);
            expect(_policyTempInfo[3][0]).to.equal(token1.address);
            // check isFuncNamesOfInvestPolicy
            expect(await investPolicyTemp.isFuncNamesOfInvestPolicy("invest")).to.equal(true);
            expect(await investPolicyTemp.isFuncNamesOfInvestPolicy("withdrawFromDefi")).to.equal(true);
            expect(await investPolicyTemp.isFuncNamesOfInvestPolicy("settle")).to.equal(true);
            expect(await investPolicyTemp.isFuncNamesOfInvestPolicy("withdraw")).to.equal(true);
            expect(await investPolicyTemp.isFuncNamesOfInvestPolicy("withdrawAfterSettle")).to.equal(true);
            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("CreatePolicyTemp");
            expect(eptEvent?.eventSignature)
                .to.equal("CreatePolicyTemp(address,uint256)");
            let amounts = eptEvent?.args;
            expect(amounts?.sender).to.equal(owner.address);
            expect(amounts?.policyTempNo).to.equal(_policyTempNo + 1);
        })

        it("createPolicyTemp failed", async () => {
            // defis.length or tokens.length must > 0
            await expect(investPolicyTemp.createPolicyTemp("test", [], []))
                .to.revertedWith("The len of _defis and _tokens must GT 0");

            // _defis has non-contract address
            await expect(investPolicyTemp.createPolicyTemp("test", [bob.address], [token1.address]))
                .to.revertedWith("The array of _defis has non-contract address");

            // _tokens has non-contract address
            await expect(investPolicyTemp.createPolicyTemp("test", [defi1.address], [bob.address]))
                .to.revertedWith("The array of _tokens has non-contract address");
        })

        it("modifyPolicyTemp", async () => {
            let _detail = "defi1"; let _newDetail = "defi2"; let _policyTempNo = 1;
            // createPolicyTemp: defi1, token1
            await investPolicyTemp.createPolicyTemp(_detail, [defi1.address], [token1.address])
            let _policyTempInfo = await investPolicyTemp.policyTempInfo(_policyTempNo);
            expect(_policyTempInfo[0]).to.equal(owner.address);
            expect(_policyTempInfo[1]).to.equal(_detail);
            expect(_policyTempInfo[2].length).to.equal(1);
            expect(_policyTempInfo[2][0]).to.equal(defi1.address);
            expect(_policyTempInfo[3].length).to.equal(1);
            expect(_policyTempInfo[3][0]).to.equal(token1.address);

            // do call
            let tx = await investPolicyTemp.modifyPolicyTemp(_policyTempNo, _newDetail, [defi2.address], [token2.address]);

            // check
            _policyTempInfo = await investPolicyTemp.policyTempInfo(_policyTempNo);
            expect(_policyTempInfo[0]).to.equal(owner.address);
            expect(_policyTempInfo[1]).to.equal(_newDetail);
            expect(_policyTempInfo[2].length).to.equal(1);
            expect(_policyTempInfo[2][0]).to.equal(defi2.address);
            expect(_policyTempInfo[3].length).to.equal(1);
            expect(_policyTempInfo[3][0]).to.equal(token2.address);
            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("ModifyPolicyTemp");
            expect(eptEvent?.eventSignature)
                .to.equal("ModifyPolicyTemp(address,uint256)");
            let amounts = eptEvent?.args;
            expect(amounts?.sender).to.equal(owner.address);
            expect(amounts?.policyTempNo).to.equal(_policyTempNo);
        })

        it("modifyPolicyTemp failed", async () => {
            await investPolicyTemp.createPolicyTemp("1", [defi1.address], [token1.address])
            await expect(investPolicyTemp.connect(bob).modifyPolicyTemp(1, "", [], [], {from:bob.address}))
                .to.revertedWith("Only Owner of policyTemps can call")

            // _defis has non-contract address
            await expect(investPolicyTemp.modifyPolicyTemp(1, "test", [bob.address], [token1.address]))
                .to.revertedWith("The array of _defis has non-contract address");

            // _tokens has non-contract address
            await expect(investPolicyTemp.modifyPolicyTemp(1, "test", [defi1.address], [bob.address]))
                .to.revertedWith("The array of _tokens has non-contract address");
        })

        it("removePolicyTemp", async () => {
            let _detail = "test"; let _policyTempNo = 1;
            await investPolicyTemp.createPolicyTemp(_detail, [defi1.address], [token1.address]);
            expect(await investPolicyTemp.isPolicyTempNoExisted(_policyTempNo)).to.equal(true);
            let _policyTempInfo = await investPolicyTemp.policyTempInfo(_policyTempNo);
            expect(_policyTempInfo[0]).to.equal(owner.address);
            expect(_policyTempInfo[1]).to.equal(_detail);
            expect(_policyTempInfo[2].length).to.equal(1);
            expect(_policyTempInfo[2][0]).to.equal(defi1.address);
            expect(_policyTempInfo[3].length).to.equal(1);
            expect(_policyTempInfo[3][0]).to.equal(token1.address);

            // do call
            await investPolicyTemp.removePolicyTemp(_policyTempNo);
            _policyTempInfo = await investPolicyTemp.policyTempInfo(_policyTempNo);
            expect(_policyTempInfo[0]).to.equal(ADDRESS_ZERO);
            expect(_policyTempInfo[1]).to.equal("");
            expect(_policyTempInfo[2].length).to.equal(0);
            expect(_policyTempInfo[3].length).to.equal(0);
        })

        it("removePolicyTemp failed", async () => {
            await investPolicyTemp.createPolicyTemp("1", [defi1.address], [token1.address])
            await expect(investPolicyTemp.connect(bob).removePolicyTemp(1, {from:bob.address}))
                .to.revertedWith("Only Owner of policyTemps can call")
        })

        it("completeInfos2Defi", async () => {
            type DeFiInfo = { name: string, detail: string }
            let _defiInfo1: DeFiInfo = { name: "defi1", detail: "defi1's detail" };
            let _defiInfo2: DeFiInfo = { name: "defi2", detail: "defi2's detail" };
            // pre state
            let _defiInfo = await investPolicyTemp.defiInfos(defi1.address);
            expect(_defiInfo.name).to.equal("");
            expect(_defiInfo.detail).to.equal("");
            _defiInfo = await investPolicyTemp.defiInfos(defi2.address);
            expect(_defiInfo.name).to.equal("");
            expect(_defiInfo.detail).to.equal("");

            // do call
            await investPolicyTemp.completeInfos2Defi([_defiInfo1, _defiInfo2], [defi1.address, defi2.address])
            // check
            _defiInfo = await investPolicyTemp.defiInfos(defi1.address);
            expect(_defiInfo.name).to.equal("defi1");
            expect(_defiInfo.detail).to.equal("defi1's detail");
            _defiInfo = await investPolicyTemp.defiInfos(defi2.address);
            expect(_defiInfo.name).to.equal("defi2");
            expect(_defiInfo.detail).to.equal("defi2's detail");
        })

        it("completeInfos2Defi failed", async () => {
            type DeFiInfo = { name: string, detail: string }
            let _defiInfo1: DeFiInfo = { name: "defi1", detail: "defi1's detail" };
            // not owner
            await expect(investPolicyTemp.connect(bob).completeInfos2Defi([], [], {from:bob.address}))
                .to.revertedWith("Ownable: caller is not the owner");
            // lens not match
            await expect(investPolicyTemp.completeInfos2Defi([], [defi1.address]))
                .to.revertedWith("The lens not match");
            // lens must GT 0
            await expect(investPolicyTemp.completeInfos2Defi([], []))
                .to.revertedWith("The len of _defis must GT 0");
            // non-contract defi
            await expect(investPolicyTemp.completeInfos2Defi([_defiInfo1], [bob.address]))
                .to.revertedWith("Non-contract address");
        })

        it("addInvestFuncs2Defi", async() => {
            type Func = { signature: string, desc: string, selector: string };
            let _investFunc1: Func = { signature: "sign1", desc: "desc1", selector: "0x12345678" };
            let _investFunc2: Func = { signature: "sign2", desc: "desc2", selector: "0x87654321" };
            expect(await investPolicyTemp.hasFuncs(defi1.address, "0x12345678")).to.equal(false);
            expect(await investPolicyTemp.hasFuncs(defi1.address, "0x87654321")).to.equal(false);

            // do call
            await investPolicyTemp.addInvestFuncs2Defi([_investFunc1, _investFunc2], defi1.address);
            // check
            expect(await investPolicyTemp.getDefiInvestInfoLen(defi1.address)).to.equal(2);
            let _func = await investPolicyTemp.defiInvestFuncs(defi1.address, 0);
            expect(_func.signature).to.equal("sign1");
            expect(_func.desc).to.equal("desc1");
            expect(_func.selector).to.equal("0x12345678");
            _func = await investPolicyTemp.defiInvestFuncs(defi1.address, 1);
            expect(_func.signature).to.equal("sign2");
            expect(_func.desc).to.equal("desc2");
            expect(_func.selector).to.equal("0x87654321");

            expect(await investPolicyTemp.hasFuncs(defi1.address, "0x12345678")).to.equal(true);
            expect(await investPolicyTemp.hasFuncs(defi1.address, "0x87654321")).to.equal(true);

            // call again, nothing gonna happen
            await investPolicyTemp.addInvestFuncs2Defi([_investFunc1, _investFunc2], defi1.address);
            expect(await investPolicyTemp.getDefiInvestInfoLen(defi1.address)).to.equal(2);
        })

        it("addInvestFuncs2Defi failed", async () => {
            // not owner
            await expect(investPolicyTemp.connect(bob).addInvestFuncs2Defi([], defi1.address, {from:bob.address}))
                .to.revertedWith("Ownable: caller is not the owner");
            // length of _investFuncs is zero
            await expect(investPolicyTemp.addInvestFuncs2Defi([], defi1.address))
                .to.revertedWith("The len of investFuncs must GT 0");
            // non-contract defi
            type Func = { signature: string, desc: string, selector: string };
            let _investFunc1: Func = { signature: "sign1", desc: "desc1", selector: "0x12345678" };
            await expect(investPolicyTemp.addInvestFuncs2Defi([_investFunc1], bob.address))
                .to.revertedWith("Non-contract address");
        })

        it("addQueryFuncs2Defi", async() => {
            type Func = { signature: string, desc: string, selector: string };
            let _queryFunc1: Func = { signature: "sign1", desc: "desc1", selector: "0x12345678" };
            let _queryFunc2: Func = { signature: "sign2", desc: "desc2", selector: "0x87654321" };
            expect(await investPolicyTemp.hasFuncs(defi1.address, "0x12345678")).to.equal(false);
            expect(await investPolicyTemp.hasFuncs(defi1.address, "0x87654321")).to.equal(false);

            // do call
            await investPolicyTemp.addQueryFuncs2Defi([_queryFunc1, _queryFunc2], defi1.address);
            // check
            expect(await investPolicyTemp.getDefiQueryInfoLen(defi1.address)).to.equal(2);
            let _func = await investPolicyTemp.defiQueryFuncs(defi1.address, 0);
            expect(_func.signature).to.equal("sign1");
            expect(_func.desc).to.equal("desc1");
            expect(_func.selector).to.equal("0x12345678");
            _func = await investPolicyTemp.defiQueryFuncs(defi1.address, 1);
            expect(_func.signature).to.equal("sign2");
            expect(_func.desc).to.equal("desc2");
            expect(_func.selector).to.equal("0x87654321");

            expect(await investPolicyTemp.hasFuncs(defi1.address, "0x12345678")).to.equal(true);
            expect(await investPolicyTemp.hasFuncs(defi1.address, "0x87654321")).to.equal(true);

            // call again, nothing gonna happen
            await investPolicyTemp.addQueryFuncs2Defi([_queryFunc1, _queryFunc2], defi1.address);
            expect(await investPolicyTemp.getDefiQueryInfoLen(defi1.address)).to.equal(2);
        })

        it("addQueryFuncs2Defi failed", async () => {
            // not owner
            await expect(investPolicyTemp.connect(bob).addQueryFuncs2Defi([], defi1.address, {from:bob.address}))
                .to.revertedWith("Ownable: caller is not the owner");
            // length of _queryFuncs is zero
            await expect(investPolicyTemp.addQueryFuncs2Defi([], defi1.address))
                .to.revertedWith("The len of queryFuncs must GT 0");
            // non-contract defi
            type Func = { signature: string, desc: string, selector: string };
            let _queryFunc1: Func = { signature: "sign1", desc: "desc1", selector: "0x12345678" };
            await expect(investPolicyTemp.addQueryFuncs2Defi([_queryFunc1], bob.address))
                .to.revertedWith("Non-contract address");
        })

        it("setSwapFeeV3", async () => {
            expect(await investPolicyTemp.swapFeeV3(defi1.address, defi2.address)).to.equal(0);
            expect(await investPolicyTemp.swapFeeV3(token1.address, token2.address)).to.equal(0);

            // do call
            let _swapFees = [2, 6];
            await investPolicyTemp.setSwapFeeV3([defi1.address, token1.address], [defi2.address, token2.address], _swapFees);
            // check
            expect(await investPolicyTemp.swapFeeV3(defi1.address, defi2.address)).to.equal(2);
            expect(await investPolicyTemp.swapFeeV3(token1.address, token2.address)).to.equal(6);
        })

        it("setSwapFeeV3 failed", async () => {
            // not owner
            await expect(investPolicyTemp.connect(bob).setSwapFeeV3([], [], [], {from:bob.address}))
                .to.revertedWith("Ownable: caller is not the owner");
            // length of _queryFuncs is zero
            await expect(investPolicyTemp.setSwapFeeV3([defi1.address], [defi2.address], [1, 2]))
                .to.revertedWith("The lens not match");
        })

        it("setCanOperate", async () => {
            let _funcNames = ["invest", "withdraw"]; let _selectors = ["0x12345678", "0x87654321"];
            await investPolicyTemp.setCanOperate([defi1.address, defi2.address], _funcNames, _selectors);
            expect(await investPolicyTemp.canOperate(defi1.address, _funcNames[0], _selectors[0])).to.equal(false);
            expect(await investPolicyTemp.canOperate(defi2.address, _funcNames[1], _selectors[1])).to.equal(false);

            await investPolicyTemp.createPolicyTemp("test", [defi1.address, defi2.address], [token1.address]);
            await investPolicyTemp.setCanOperate([defi1.address, defi2.address], _funcNames, _selectors);
            expect(await investPolicyTemp.canOperate(defi1.address, _funcNames[0], _selectors[0])).to.equal(true);
            expect(await investPolicyTemp.canOperate(defi2.address, _funcNames[1], _selectors[1])).to.equal(true);
        })

        it("setCanOperate failed", async () => {
            // not owner
            await expect(investPolicyTemp.connect(bob).setCanOperate([defi1.address], ["invest"], ["0x12345678"]))
                .to.revertedWith("Ownable: caller is not the owner");

            // the length not match
            await expect(investPolicyTemp.setCanOperate([defi1.address], [], []))
                .to.revertedWith("The lengths mismatch");

            // the length must GT 0
            await expect(investPolicyTemp.setCanOperate([], [], []))
                .to.revertedWith("The len must GT 0");
        })
    })
})
