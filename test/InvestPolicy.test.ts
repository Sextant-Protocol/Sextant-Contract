import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {InvestPolicyMock, MockToken, OracleV3, InvestPolicyTemplate} from "../typechain";

describe("InvestPolicy contract test", function () {

    let investPolicy: InvestPolicyMock;
    let usdt: MockToken;
    let usdc: MockToken;
    let hip: MockToken;
    let cyn: MockToken;
    let pigc: MockToken;
    let investPolicyTemplate: InvestPolicyTemplate;
    let oracle: OracleV3;

    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let defi1: SignerWithAddress;
    let defi2: SignerWithAddress;
    let defi3: SignerWithAddress;
    let fund: SignerWithAddress;
    let addrs: SignerWithAddress[];

    beforeEach(async () => {
        [owner, alice, bob, defi1, defi2, defi3, fund, ...addrs] = await ethers.getSigners();

        const MockToken = await ethers.getContractFactory("MockToken", owner);
        usdt = await MockToken.deploy("Tether USD", "USDT");
        await usdt.deployed(); // invalid token
        usdc = await MockToken.deploy("USD Coin", "USDC");
        await usdc.deployed(); // local token
        hip = await MockToken.deploy("Hippo Token", "HIP");
        await hip.deployed(); // can swap token
        cyn = await MockToken.deploy("Cycan Network Token", "CYN");
        await cyn.deployed(); // can swap token
        pigc = await MockToken.deploy("Pig Coin", "PIGC");
        await pigc.deployed(); // can not swap token


        const InvestPolicyTemplate = await ethers.getContractFactory("InvestPolicyTemplate", owner);
        investPolicyTemplate = await InvestPolicyTemplate.deploy();
        await investPolicyTemplate.deployed();

        const Oracle = await ethers.getContractFactory("OracleV3", owner);
        oracle = await Oracle.deploy();
        await oracle.deployed();

        const InvestPolicy = await ethers.getContractFactory("InvestPolicyMock", owner);
        investPolicy = await InvestPolicy.deploy(
            [defi1.address, defi2.address],
            [hip.address, pigc.address],
            usdc.address,
            investPolicyTemplate.address,
            "detail",
            fund.address,
            oracle.address
        );
        await investPolicy.deployed();
    })

    it("constructor", async () => {
        expect(await investPolicy.defis(0)).to.equal(defi1.address);
        expect(await investPolicy.defis(1)).to.equal(defi2.address);
        expect(await investPolicy.tokens(0)).to.equal(hip.address);
        expect(await investPolicy.tokens(1)).to.equal(pigc.address);
        expect(await investPolicy.localToken()).to.equal(usdc.address);
        expect(await investPolicy.investPolicyTemplate()).to.equal(investPolicyTemplate.address);
        expect(await investPolicy.detail()).to.equal("detail");
        expect(await investPolicy.oracle()).to.equal(oracle.address);
        expect(await investPolicy.isValidDefis(defi1.address)).to.equal(true);
        expect(await investPolicy.isValidDefis(defi2.address)).to.equal(true);
        expect(await investPolicy.isValidToken(hip.address)).to.equal(true);
        expect(await investPolicy.isValidToken(pigc.address)).to.equal(true);
        expect(await investPolicy.isValidToken(usdc.address)).to.equal(true);
        expect(await investPolicy.owner()).to.equal(fund.address);
    })

    describe("functions test", function () {
        beforeEach(async () => {
            await usdc.mint(investPolicy.address, 10000);
            await hip.mint(investPolicy.address, 1000000);
            await pigc.mint(investPolicy.address, 1000000);

            investPolicyTemplate.setSwapFeeV3(
                [hip.address, cyn.address],
                [usdc.address, usdc.address],
                [500, 500]
            );
        })

        it("invest", async () => {
            // do call
            //await investPolicy.connect(fund).invest(defi1.address, "0x", hip.address, true);
        })

        it("invest failed", async () => {
            // not owner
            await expect(investPolicy.connect(alice)
                .invest(defi1.address, "0x", hip.address, true))
                .to.revertedWith("Ownable: caller is not the owner");

            // invalid defi
            await expect(investPolicy.connect(fund)
                .invest(defi3.address, "0x", hip.address, true))
                .to.revertedWith("Invalid input _defi");

            // invalid token
            await expect(investPolicy.connect(fund)
                .invest(defi1.address, "0x", usdt.address, true))
                .to.revertedWith("Invalid input _token");

            // not harvest
            await expect(investPolicy.connect(fund)
                .invest(defi1.address, "0x", hip.address, true))
                .to.revertedWith("No harvest");
        })

        it("withdrawFromDefi", async () => {
            // do call
            //await investPolicy.connect(fund).withdrawFromDefi(defi1.address, "0x", 100, hip.address);
        })

        it("withdrawFromDefi failed", async () => {
            // not owner
            await expect(investPolicy.connect(alice)
                .withdrawFromDefi(defi1.address, "0x", 100000, hip.address))
                .to.revertedWith("Ownable: caller is not the owner");

            // invalid defi
            await expect(investPolicy.connect(fund)
                .withdrawFromDefi(defi3.address, "0x", 100000, hip.address))
                .to.revertedWith("Invalid input _defi");

            // invalid returnToken
            await expect(investPolicy.connect(fund)
                .withdrawFromDefi(defi1.address, "0x", 100000, usdt.address))
                .to.revertedWith("Invalid input _returnToken");

            // not harvest
            await expect(investPolicy.connect(fund)
                .withdrawFromDefi(defi1.address, "0x", 100000, hip.address))
                .to.revertedWith("No return token");
        })

        it("settle", async () => {
            // do call
            //await investPolicy.connect(fund).settle(defi1.address, "0x");
        })

        it("settle failed", async () => {
            // not owner
            await expect(investPolicy.connect(alice).settle(defi1.address, "0x"))
                .to.revertedWith("Ownable: caller is not the owner");

            // invalid defi
            await expect(investPolicy.connect(fund).settle(defi3.address, "0x"))
                .to.revertedWith("Invalid input _defi");
        })

        it("withdraw", async () => {
            // do call
            await investPolicy.connect(fund).withdraw(1000);

            // check result
            expect(await usdc.balanceOf(investPolicy.address)).to.equal(9000);
            expect(await usdc.balanceOf(fund.address)).to.equal(1000);
        })

        it("withdraw failed", async () => {
            // not owner
            await expect(investPolicy.connect(alice).withdraw(1000))
                .to.revertedWith("Ownable: caller is not the owner");

            // exceeded balance
            await expect(investPolicy.connect(fund).withdraw(20000))
                .to.revertedWith("Exceeded balance");
        })

        it("withdrawAfterSettle", async () => {
            // do call
            await investPolicy.withdrawAfterSettle();

            // check result
            expect(await usdc.balanceOf(investPolicy.address)).to.equal(0);
            expect(await usdc.balanceOf(fund.address)).to.equal(10000);
            expect(await hip.balanceOf(investPolicy.address)).to.equal(0);
            expect(await hip.balanceOf(fund.address)).to.equal(1000000);
            expect(await pigc.balanceOf(investPolicy.address)).to.equal(0);
            expect(await pigc.balanceOf(fund.address)).to.equal(1000000);
        })

        it("isSettleCompletedBeforeAfferBonus", async () => {
            // 将HIP结算成USDC

            // do call
            let result = await investPolicy.isSettleCompletedBeforeAfferBonus();

            // check result
            // expect(result).to.equal(true);
        })

        it("addPositionToken", async () => {
            // do call
            await investPolicy.connect(fund).addPositionToken([cyn.address]);

            // check result
            expect(await investPolicy.tokens(2)).to.equal(cyn.address);
            expect(await investPolicy.isValidToken(cyn.address)).to.equal(true);
        })

        it("addPositionToken failed", async () => {
            // not owner
            await expect(investPolicy.connect(alice)
                .addPositionToken([cyn.address]))
                .to.revertedWith("Ownable: caller is not the owner");
        })

        it("totalValue", async () => {
            // do call
            // await investPolicy.totalValue();
        })

        it("totalValue failed", async () => {
            // no return defi calculate value failed
            await expect(investPolicy.totalValue())
                .to.revertedWith("Calculate value failed");
        })
    })
})