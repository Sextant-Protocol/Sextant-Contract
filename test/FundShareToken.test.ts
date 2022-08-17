import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { FundShareTokenMock, MockToken } from "../typechain";
import { advanceTimeAndBlock, latestTime } from "./utilities/time";

const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

describe("FundShareToken contract test", function () {

    let fundShareToken: FundShareTokenMock;
    let usdc: MockToken;
    let usdt: MockToken;
    let elc: MockToken;

    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let addrs: SignerWithAddress[];
    beforeEach(async () => {
        [owner, alice, bob, ...addrs] = await ethers.getSigners();
        const FundSha_ = await ethers.getContractFactory("FundShareTokenMock", owner);
        const MockToken = await ethers.getContractFactory("MockToken", owner);

        usdc = await MockToken.deploy("USD Coin", "USDC");
        await usdc.deployed();
        usdt = await MockToken.deploy("USD Token", "USDT");
        await usdt.deployed();
        elc = await MockToken.deploy("Ever Last Coin", "ELC");
        await elc.deployed();

        fundShareToken = await FundSha_.deploy();
        await fundShareToken.deployed();
    })

    it("initialize", async () => {
        await fundShareToken["initialize(string,string,address[],address)"]( "FundShareToken",
          "FST",
          [usdc.address, usdt.address],
          owner.address
        );
        expect(await fundShareToken.fundAddress()).to.equal(owner.address);
        expect(await fundShareToken.bonusTokens(0)).to.equal(usdc.address);
        expect(await fundShareToken.bonusTokens(1)).to.equal(usdt.address);
        expect(await fundShareToken.bonusTokenIndex(usdc.address)).to.equal(1);
        expect(await fundShareToken.bonusTokenIndex(usdt.address)).to.equal(2);
    })

    it("initialize failed", async () => {
        await expect(fundShareToken["initialize(string,string,address[],address)"]( "FundShareToken",
          "FST",
          [usdc.address, usdt.address, usdt.address, usdt.address, usdt.address, usdt.address,
              usdt.address, usdt.address, usdt.address, usdt.address, usdt.address, usdt.address],
          owner.address
        )).to.revertedWith("Bonus tokens max is 10");
    })

    describe("functions test", function () {
        let aliceBalance = 600; let bobBalance = 400;
        let totalBalance = aliceBalance + bobBalance;
        beforeEach(async () => {
            await fundShareToken["initialize(string,string,address[],address)"]( "FundShareToken",
              "FST",
              [usdc.address, usdt.address],
              owner.address
            );
            // set balances
            await fundShareToken.mint(alice.address, aliceBalance);
            await fundShareToken.mint(bob.address, bobBalance);
            // set owner bonusTokens' balances
            await usdc.mint(owner.address, 100000);
            await usdt.mint(owner.address, 100000);
            await usdc.approve(fundShareToken.address, 100000);
            await usdt.approve(fundShareToken.address, 100000);
        })

        it("updateUsersBonusDebt", async () => {
            // update accBonusPerTokensX1e12 with offerBonus
            let usdcAmount = 5; let usdtAmount = 10;
            await fundShareToken.offerBonus(owner.address, usdc.address, usdcAmount);
            await fundShareToken.offerBonus(owner.address, usdt.address, usdtAmount);
            const usdcAcc = (await fundShareToken.accBonusPerTokensX1e12(usdc.address)).toNumber();
            const usdtAcc = (await fundShareToken.accBonusPerTokensX1e12(usdt.address)).toNumber();
            // check pre state
            expect(usdcAcc).to.equal(usdcAmount * 1e12 / totalBalance);
            expect(usdtAcc).to.equal(usdtAmount * 1e12 / totalBalance);
            expect(await fundShareToken.userBonusDebtsX1e12(alice.address, usdc.address)).to.equal(0);
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdc.address)).to.equal(0);
            expect(await fundShareToken.userBonusDebtsX1e12(alice.address, usdt.address)).to.equal(0);
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdt.address)).to.equal(0);

            // do call
            await fundShareToken.updateUsersBonusDebt(alice.address, bob.address);
            // check
            expect(await fundShareToken.userBonusDebtsX1e12(alice.address, usdc.address)).to.equal(aliceBalance * usdcAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(alice.address, usdt.address)).to.equal(aliceBalance * usdtAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdc.address)).to.equal(bobBalance * usdcAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdt.address)).to.equal(bobBalance * usdtAcc);

            // do call again with ADDRESS_ZERO
            let usdcAmount2 = 10;
            await fundShareToken.offerBonus(owner.address, usdc.address, usdcAmount2);
            const usdcAcc2 = (await fundShareToken.accBonusPerTokensX1e12(usdc.address)).toNumber();
            expect(usdcAcc2).to.equal(usdcAcc + usdcAmount2 * 1e12 / totalBalance);
            await fundShareToken.updateUsersBonusDebt(ADDRESS_ZERO, ADDRESS_ZERO);
            // alice's not change, and bob's changed.
            expect(await fundShareToken.userBonusDebtsX1e12(alice.address, usdc.address)).to.equal(aliceBalance * usdcAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(alice.address, usdt.address)).to.equal(aliceBalance * usdtAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdc.address)).to.equal(bobBalance * usdcAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdt.address)).to.equal(bobBalance * usdtAcc);
        })

        it("transfer", async () => {
            // pre state
            expect(await fundShareToken.balanceOf(alice.address)).to.equal(aliceBalance);
            expect(await fundShareToken.balanceOf(bob.address)).to.equal(bobBalance);
            let usdcAmount = 5; let usdtAmount = 10;
            await fundShareToken.offerBonus(owner.address, usdc.address, usdcAmount);
            await fundShareToken.offerBonus(owner.address, usdt.address, usdtAmount);
            const usdcAcc = (await fundShareToken.accBonusPerTokensX1e12(usdc.address)).toNumber();
            const usdtAcc = (await fundShareToken.accBonusPerTokensX1e12(usdt.address)).toNumber();

            // do call
            await fundShareToken.connect(alice).transfer(bob.address, 100, {from:alice.address});

            // check bonus
            let bonusUsdcAlice = (usdcAcc * aliceBalance - 0) / 1e12;
            let bonusUsdtAlice = (usdtAcc * aliceBalance - 0) / 1e12;
            let bonusUsdcBob = (usdcAcc * bobBalance - 0) / 1e12;
            let bonusUsdtBob = (usdtAcc * bobBalance - 0) / 1e12;
            expect(await usdc.balanceOf(alice.address)).to.equal(bonusUsdcAlice);
            expect(await usdt.balanceOf(alice.address)).to.equal(bonusUsdtAlice);
            expect(await usdc.balanceOf(bob.address)).to.equal(bonusUsdcBob);
            expect(await usdt.balanceOf(bob.address)).to.equal(bonusUsdtBob);
            // check balance
            let aliceFST = aliceBalance - 100; let bobFST = bobBalance + 100;
            expect(await fundShareToken.balanceOf(alice.address)).to.equal(aliceFST);
            expect(await fundShareToken.balanceOf(bob.address)).to.equal(bobFST);
            // check Debt
            expect(await fundShareToken.userBonusDebtsX1e12(alice.address, usdc.address)).to.equal(aliceFST * usdcAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(alice.address, usdt.address)).to.equal(aliceFST * usdtAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdc.address)).to.equal(bobFST * usdcAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdt.address)).to.equal(bobFST * usdtAcc);
        })

        it("transfer failed", async () => {
            // insufficient balance available
            await fundShareToken.connect(alice).approveLock(owner.address, 500, 86400, {from:alice.address});
            await fundShareToken.lock(alice.address, 500, 3600);
            await expect(fundShareToken.connect(alice).transfer(bob.address, 200, {from:alice.address}))
                .to.revertedWith("The amount transferred exceeds the balance after locked");
        })

        it("transferFrom", async () => {
            // pre state
            expect(await fundShareToken.balanceOf(alice.address)).to.equal(aliceBalance);
            expect(await fundShareToken.balanceOf(bob.address)).to.equal(bobBalance);
            let usdcAmount = 5; let usdtAmount = 10;
            await fundShareToken.offerBonus(owner.address, usdc.address, usdcAmount);
            await fundShareToken.offerBonus(owner.address, usdt.address, usdtAmount);
            const usdcAcc = (await fundShareToken.accBonusPerTokensX1e12(usdc.address)).toNumber();
            const usdtAcc = (await fundShareToken.accBonusPerTokensX1e12(usdt.address)).toNumber();
            // approve owner
            await fundShareToken.connect(alice).approve(owner.address, aliceBalance, {from:alice.address});

            // do call
            await fundShareToken.transferFrom(alice.address, bob.address, 100);

            // check bonus
            let bonusUsdcAlice = (usdcAcc * aliceBalance - 0) / 1e12;
            let bonusUsdtAlice = (usdtAcc * aliceBalance - 0) / 1e12;
            let bonusUsdcBob = (usdcAcc * bobBalance - 0) / 1e12;
            let bonusUsdtBob = (usdtAcc * bobBalance - 0) / 1e12;
            expect(await usdc.balanceOf(alice.address)).to.equal(bonusUsdcAlice);
            expect(await usdt.balanceOf(alice.address)).to.equal(bonusUsdtAlice);
            expect(await usdc.balanceOf(bob.address)).to.equal(bonusUsdcBob);
            expect(await usdt.balanceOf(bob.address)).to.equal(bonusUsdtBob);
            // check balance
            let aliceFST = aliceBalance - 100; let bobFST = bobBalance + 100;
            expect(await fundShareToken.balanceOf(alice.address)).to.equal(aliceFST);
            expect(await fundShareToken.balanceOf(bob.address)).to.equal(bobFST);
            // check Debt
            expect(await fundShareToken.userBonusDebtsX1e12(alice.address, usdc.address)).to.equal(aliceFST * usdcAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(alice.address, usdt.address)).to.equal(aliceFST * usdtAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdc.address)).to.equal(bobFST * usdcAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdt.address)).to.equal(bobFST * usdtAcc);
        })

        it("transferFrom failed", async () => {
            // insufficient balance available
            await fundShareToken.connect(alice).approveLock(owner.address, 500, 86400, {from:alice.address});
            await fundShareToken.lock(alice.address, 500, 3600);
            // approve owner
            await fundShareToken.connect(alice).approve(owner.address, aliceBalance, {from:alice.address});
            await expect(fundShareToken.transferFrom(alice.address, bob.address, 200))
                .to.revertedWith("The amount transferred exceeds the balance after locked");
        })

        it("burn", async () => {
            // pre state
            expect(await fundShareToken.balanceOf(alice.address)).to.equal(aliceBalance);
            expect(await fundShareToken.balanceOf(bob.address)).to.equal(bobBalance);
            let usdcAmount = 5; let usdtAmount = 10;
            await fundShareToken.offerBonus(owner.address, usdc.address, usdcAmount);
            await fundShareToken.offerBonus(owner.address, usdt.address, usdtAmount);
            const usdcAcc = (await fundShareToken.accBonusPerTokensX1e12(usdc.address)).toNumber();
            const usdtAcc = (await fundShareToken.accBonusPerTokensX1e12(usdt.address)).toNumber();

            // do call
            await fundShareToken.connect(alice).burn(100, {from:alice.address});
            await fundShareToken.connect(bob).burn(100, {from:bob.address});

            // check bonus
            let bonusUsdcAlice = (usdcAcc * aliceBalance - 0) / 1e12;
            let bonusUsdtAlice = (usdtAcc * aliceBalance - 0) / 1e12;
            let bonusUsdcBob = (usdcAcc * bobBalance - 0) / 1e12;
            let bonusUsdtBob = (usdtAcc * bobBalance - 0) / 1e12;
            expect(await usdc.balanceOf(alice.address)).to.equal(bonusUsdcAlice);
            expect(await usdt.balanceOf(alice.address)).to.equal(bonusUsdtAlice);
            expect(await usdc.balanceOf(bob.address)).to.equal(bonusUsdcBob);
            expect(await usdt.balanceOf(bob.address)).to.equal(bonusUsdtBob);
            // check balance
            let aliceFST = aliceBalance - 100; let bobFST = bobBalance - 100;
            expect(await fundShareToken.balanceOf(alice.address)).to.equal(aliceFST);
            expect(await fundShareToken.balanceOf(bob.address)).to.equal(bobFST);
            // check Debt
            expect(await fundShareToken.userBonusDebtsX1e12(alice.address, usdc.address)).to.equal(aliceFST * usdcAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(alice.address, usdt.address)).to.equal(aliceFST * usdtAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdc.address)).to.equal(bobFST * usdcAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdt.address)).to.equal(bobFST * usdtAcc);
        })

        it("burn failed", async () => {
            // insufficient balance available
            await fundShareToken.connect(alice).approveLock(owner.address, 500, 86400, {from:alice.address});
            await fundShareToken.lock(alice.address, 500, 3600);
            await expect(fundShareToken.connect(alice).burn(200, {from:alice.address}))
                .to.revertedWith("The amount transferred exceeds the balance after locked");
        })

        it("burnFrom", async () => {
            // pre state
            expect(await fundShareToken.balanceOf(alice.address)).to.equal(aliceBalance);
            let usdcAmount = 5; let usdtAmount = 10;
            await fundShareToken.offerBonus(owner.address, usdc.address, usdcAmount);
            await fundShareToken.offerBonus(owner.address, usdt.address, usdtAmount);
            const usdcAcc = (await fundShareToken.accBonusPerTokensX1e12(usdc.address)).toNumber();
            const usdtAcc = (await fundShareToken.accBonusPerTokensX1e12(usdt.address)).toNumber();
            // approve owner
            await fundShareToken.connect(alice).approve(owner.address, aliceBalance, {from:alice.address});

            // do call
            await fundShareToken.burnFrom(alice.address, 100);

            // check bonus
            let bonusUsdcAlice = (usdcAcc * aliceBalance - 0) / 1e12;
            let bonusUsdtAlice = (usdtAcc * aliceBalance - 0) / 1e12;
            expect(await usdc.balanceOf(alice.address)).to.equal(bonusUsdcAlice);
            expect(await usdt.balanceOf(alice.address)).to.equal(bonusUsdtAlice);
            // check balance
            let aliceFST = aliceBalance - 100;
            expect(await fundShareToken.balanceOf(alice.address)).to.equal(aliceFST);
            // check Debt
            const aliceDebt = (await fundShareToken.userBonusDebtsX1e12(alice.address, usdc.address)).toNumber();
            expect(aliceDebt).to.equal(aliceFST * usdcAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(alice.address, usdt.address)).to.equal(aliceFST * usdtAcc);

            // offer bonus again
            let usdcAmount2 = 18;
            await fundShareToken.offerBonus(owner.address, usdc.address, usdcAmount2);
            const usdcAcc2 = (await fundShareToken.accBonusPerTokensX1e12(usdc.address)).toNumber();

            // do call again
            await fundShareToken.burnFrom(alice.address, 200);
            let bonusUsdcAlice2 = (usdcAcc2 * aliceFST - aliceDebt) / 1e12;
            expect(await usdc.balanceOf(alice.address)).to.equal(bonusUsdcAlice + bonusUsdcAlice2);

            aliceFST = aliceFST - 200;
            expect(await fundShareToken.userBonusDebtsX1e12(alice.address, usdc.address)).to.equal(aliceFST * usdcAcc2);
        })

        it("burnFrom failed", async () => {
            // insufficient balance available
            await fundShareToken.connect(alice).approveLock(owner.address, 500, 86400, {from:alice.address});
            await fundShareToken.lock(alice.address, 500, 3600);
            // approve owner
            await fundShareToken.connect(alice).approve(owner.address, aliceBalance, {from:alice.address});
            await expect(fundShareToken.burnFrom(alice.address, 200))
                .to.revertedWith("The amount transferred exceeds the balance after locked");
        })

        it("mint", async () => {
            // pre state
            expect(await fundShareToken.balanceOf(bob.address)).to.equal(bobBalance);
            let usdcAmount = 5; let usdtAmount = 10;
            await fundShareToken.offerBonus(owner.address, usdc.address, usdcAmount);
            await fundShareToken.offerBonus(owner.address, usdt.address, usdtAmount);
            const usdcAcc = (await fundShareToken.accBonusPerTokensX1e12(usdc.address)).toNumber();
            const usdtAcc = (await fundShareToken.accBonusPerTokensX1e12(usdt.address)).toNumber();

            // do call
            await fundShareToken.mint(bob.address, 200);

            // check bonus
            let bonusUsdcBob = (usdcAcc * bobBalance - 0) / 1e12;
            let bonusUsdtBob = (usdtAcc * bobBalance - 0) / 1e12;
            expect(await usdc.balanceOf(bob.address)).to.equal(bonusUsdcBob);
            expect(await usdt.balanceOf(bob.address)).to.equal(bonusUsdtBob);
            // check balance
            let bobFST = bobBalance + 200;
            expect(await fundShareToken.balanceOf(bob.address)).to.equal(bobFST);
            // check Debt
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdc.address)).to.equal(bobFST * usdcAcc);
            const bobDebt = (await fundShareToken.userBonusDebtsX1e12(bob.address, usdt.address)).toNumber();
            expect(bobDebt).to.equal(bobFST * usdtAcc);

            // offer bonus again
            let usdtAmount2 = 12;
            await fundShareToken.offerBonus(owner.address, usdt.address, usdtAmount2);
            const usdtAcc2 = (await fundShareToken.accBonusPerTokensX1e12(usdt.address)).toNumber();

            // do call again
            await fundShareToken.mint(bob.address, 800);
            let bonusUsdtBob2 = (usdtAcc2 * bobFST - bobDebt) / 1e12;
            expect(await usdt.balanceOf(bob.address)).to.equal(bonusUsdtBob + bonusUsdtBob2);

            bobFST = bobFST + 800;
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdt.address)).to.equal(bobFST * usdtAcc2);
        })

        it("mint failed", async () => {
            // not MINTER_ROLE
            await expect(fundShareToken.connect(alice).mint(alice.address, 100000, {from:alice.address}))
                .to.revertedWith("ERC20PresetMinterPauser: must have minter role to mint");
        })

        it("drawBonus", async () => {
            // pre state
            expect(await fundShareToken.balanceOf(bob.address)).to.equal(bobBalance);
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdc.address)).to.equal(0);
            let usdcAmount = 5; let usdtAmount = 10;
            await fundShareToken.offerBonus(owner.address, usdc.address, usdcAmount);
            await fundShareToken.offerBonus(owner.address, usdt.address, usdtAmount);
            const usdcAcc = (await fundShareToken.accBonusPerTokensX1e12(usdc.address)).toNumber();
            const usdtAcc = (await fundShareToken.accBonusPerTokensX1e12(usdt.address)).toNumber();

            // do call
            await fundShareToken.drawBonus(bob.address);

            // check bonus
            let bonusUsdcBob = (usdcAcc * bobBalance - 0) / 1e12;
            let bonusUsdtBob = (usdtAcc * bobBalance - 0) / 1e12;
            expect(await usdc.balanceOf(bob.address)).to.equal(bonusUsdcBob);
            expect(await usdc.balanceOf(fundShareToken.address)).to.equal(usdcAmount - bonusUsdcBob)
            expect(await usdt.balanceOf(bob.address)).to.equal(bonusUsdtBob);
            expect(await usdt.balanceOf(fundShareToken.address)).to.equal(usdtAmount - bonusUsdtBob)
            // balance not change, just get the bonus
            expect(await fundShareToken.balanceOf(bob.address)).to.equal(bobBalance);
            // check Debt
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdc.address)).to.equal(bobBalance * usdcAcc);
            expect(await fundShareToken.userBonusDebtsX1e12(bob.address, usdt.address)).to.equal(bobBalance * usdtAcc);
        })

        it("drawBonus failed", async () => {
            await expect(fundShareToken.connect(bob).drawBonus(bob.address, {from:bob.address}))
                .to.revertedWith("Only fund can call");
        })

        it("offerBonus", async () => {
            // pre state
            const usdcOwner = (await usdc.balanceOf(owner.address)).toNumber();
            const usdtOwner = (await usdt.balanceOf(owner.address)).toNumber();
            expect(usdcOwner).to.equal(100000);
            expect(usdtOwner).to.equal(100000);
            expect(await usdc.balanceOf(fundShareToken.address)).to.equal(0);
            expect(await usdt.balanceOf(fundShareToken.address)).to.equal(0);
            expect(await fundShareToken.accBonusPerTokensX1e12(usdc.address)).to.equal(0);
            expect(await fundShareToken.accBonusPerTokensX1e12(usdt.address)).to.equal(0);

            // do call
            let usdcAmount = 5; let usdtAmount = 10; let elcAmount = 15;
            await fundShareToken.offerBonus(owner.address, usdc.address, usdcAmount);
            await fundShareToken.offerBonus(owner.address, usdt.address, usdtAmount);
            await elc.mint(owner.address, elcAmount);
            await elc.approve(fundShareToken.address, elcAmount);
            await fundShareToken.offerBonus(owner.address, elc.address, elcAmount);

            // check result
            expect(await usdc.balanceOf(owner.address)).to.equal(usdcOwner - usdcAmount);
            expect(await usdt.balanceOf(owner.address)).to.equal(usdtOwner - usdtAmount);
            expect(await elc.balanceOf(owner.address)).to.equal(0)
            expect(await usdc.balanceOf(fundShareToken.address)).to.equal(usdcAmount);
            expect(await usdt.balanceOf(fundShareToken.address)).to.equal(usdtAmount);
            expect(await elc.balanceOf(fundShareToken.address)).to.equal(elcAmount);
            expect(await fundShareToken.accBonusPerTokensX1e12(usdc.address)).to.equal(usdcAmount * 1e12 / totalBalance);
            expect(await fundShareToken.accBonusPerTokensX1e12(usdt.address)).to.equal(usdtAmount * 1e12 / totalBalance);
            expect(await fundShareToken.accBonusPerTokensX1e12(elc.address)).to.equal(elcAmount * 1e12 / totalBalance);
            // check bonusToken and its' index
            expect(await fundShareToken.bonusTokens(0)).to.equal(usdc.address);
            expect(await fundShareToken.bonusTokens(1)).to.equal(usdt.address);
            expect(await fundShareToken.bonusTokens(2)).to.equal(elc.address);
            expect(await fundShareToken.bonusTokenIndex(usdc.address)).to.equal(1);
            expect(await fundShareToken.bonusTokenIndex(usdt.address)).to.equal(2);
            expect(await fundShareToken.bonusTokenIndex(elc.address)).to.equal(3);
        })

        it("offerBonus failed", async () => {
            // not fundAddress call
            await expect(fundShareToken.connect(bob)
                .offerBonus(owner.address, usdc.address, 10000, {from:bob.address}))
                .to.revertedWith("Only fund call");
        })

        it("pendingBonus", async () => {
            // do call
            let eptInfo = await fundShareToken.pendingBonus(alice.address);
            expect(eptInfo[0][0]).to.equal(usdc.address);
            expect(eptInfo[0][1]).to.equal(usdt.address);
            expect(eptInfo[1][0]).to.equal(0);
            expect(eptInfo[1][1]).to.equal(0);

            // offerBonus
            let usdcAmount = 5; let usdtAmount = 10;
            await fundShareToken.offerBonus(owner.address, usdc.address, usdcAmount);
            await fundShareToken.offerBonus(owner.address, usdt.address, usdtAmount);
            const usdcAcc = (await fundShareToken.accBonusPerTokensX1e12(usdc.address)).toNumber();
            const usdtAcc = (await fundShareToken.accBonusPerTokensX1e12(usdt.address)).toNumber();

            // do call again
            eptInfo = await fundShareToken.pendingBonus(alice.address);
            expect(eptInfo[0][0]).to.equal(usdc.address);
            expect(eptInfo[0][1]).to.equal(usdt.address);
            expect(eptInfo[1][0]).to.equal(aliceBalance * usdcAcc / 1e12);
            expect(eptInfo[1][1]).to.equal(aliceBalance * usdtAcc / 1e12);
        })

        it("lockablesOf", async () => {
            // no lock amount, lockable amount equal to balance
            expect(await fundShareToken.lockablesOf(alice.address)).to.equal(aliceBalance);
            expect(await fundShareToken.lockablesOf(bob.address)).to.equal(bobBalance);

            // lock part of balance
            let lockAmount = 300;
            await fundShareToken.connect(alice).approveLock(owner.address, lockAmount, 86400, {from:alice.address});
            await fundShareToken.connect(bob).approveLock(owner.address, lockAmount, 3600, {from:bob.address});
            await fundShareToken.lock(alice.address, lockAmount, 3600);
            await fundShareToken.lock(bob.address, lockAmount, 60);

            expect(await fundShareToken.lockablesOf(alice.address)).to.equal(aliceBalance - lockAmount);
            expect(await fundShareToken.lockablesOf(bob.address)).to.equal(bobBalance - lockAmount);

            await advanceTimeAndBlock(100);
            expect(await fundShareToken.lockablesOf(alice.address)).to.equal(aliceBalance - lockAmount);
            expect(await fundShareToken.lockablesOf(bob.address)).to.equal(bobBalance);
        })

        it("approveLock", async () => {
            let lockAmount = 300; let maxDuration = 86400;
            let tx = await fundShareToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});

            // check result
            let eptInfo = await fundShareToken.getApproveLockInfo(alice.address);
            expect(eptInfo[0]).to.equal(owner.address);
            expect(eptInfo[1]).to.equal(lockAmount);
            expect(eptInfo[2]).to.equal(maxDuration);

            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("ApproveLock");
            expect(eptEvent?.eventSignature)
                .to.equal("ApproveLock(address,address,uint256,uint256)");
            let amounts = eptEvent?.args;
            expect(amounts?.approver).to.equal(alice.address);
            expect(amounts?.locker).to.equal(owner.address);
            expect(amounts?.duration).to.equal(maxDuration);
            expect(amounts?.amount).to.equal(lockAmount);
        })

        it("approveLock failed", async () => {
            // insufficient balance, owner's balance is zero
            await expect(fundShareToken.approveLock(alice.address, 100, 3600))
                .to.revertedWith("the amount of approve need LT balance of _msgSender");

            // there is still amount locked
            await fundShareToken.connect(alice).approveLock(owner.address, 100, 3600, {from:alice.address});
            await fundShareToken.lock(alice.address, 100, 60);
            await expect(fundShareToken.connect(alice)
                .approveLock(owner.address, 200, 60, {from:alice.address}))
                .to.revertedWith("Not meet approve lock condition");
        })

        it("lock", async () => {
            let lockAmount = 300; let maxDuration = 86400; let lockDuration = 60;
            await fundShareToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            let tx = await fundShareToken.lock(alice.address, lockAmount, lockDuration);
            let _time = await latestTime();

            // check approveLockInfo
            let eptInfo = await fundShareToken.getApproveLockInfo(alice.address);
            expect(eptInfo[0]).to.equal(owner.address);
            expect(eptInfo[1]).to.equal(lockAmount - lockAmount);
            expect(eptInfo[2]).to.equal(maxDuration);
            // check lockInfo
            let eptInfo2 = await fundShareToken.getLockInfo(alice.address);
            expect(eptInfo2[0]).to.equal(owner.address);
            expect(eptInfo2[1]).to.equal(lockAmount);
            expect(eptInfo2[2]).to.equal(_time);
            expect(eptInfo2[3]).to.equal(lockDuration);

            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("Lock");
            expect(eptEvent?.eventSignature)
                .to.equal("Lock(address,address,uint256,uint256)");
            let amounts = eptEvent?.args;
            expect(amounts?.approver).to.equal(alice.address);
            expect(amounts?.locker).to.equal(owner.address);
            expect(amounts?.duration).to.equal(lockDuration);
            expect(amounts?.amount).to.equal(lockAmount);
        })

        it("lock failed", async () => {
            // insufficient balance available
            await expect(fundShareToken.lock(alice.address, 1000, 60)).to.revertedWith("Exceeding balance");

            // no locker, means locker is not owner.address
            await expect(fundShareToken.lock(alice.address, 100, 60)).to.revertedWith("_msgSender is not locker of user");

            // lockApprove amount must GT amount
            await fundShareToken.connect(alice).approveLock(owner.address, 100, 3600, {from:alice.address});
            await expect(fundShareToken.lock(alice.address, 200, 60)).to.revertedWith("Exceeding the maximum amount");

            // lockApprove duration must GT duration
            await expect(fundShareToken.lock(alice.address, 100, 6000)).to.revertedWith("Exceeding the maximum duration");

            // there is still amount locked, amount locked should be 0
            await fundShareToken.lock(alice.address, 50, 60);
            await expect(fundShareToken.lock(alice.address, 50, 60))
                .to.revertedWith("amount == 0 or passed duration");
        })

        it("unlockAll", async () => {
            let lockAmount = 300; let maxDuration = 86400; let lockDuration = 60;
            await fundShareToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            await fundShareToken.lock(alice.address, lockAmount, lockDuration);
            let _time = await latestTime();
            // check lockInfo
            let eptInfo = await fundShareToken.getLockInfo(alice.address);
            expect(eptInfo[0]).to.equal(owner.address);
            expect(eptInfo[1]).to.equal(lockAmount);
            expect(eptInfo[2]).to.equal(_time);
            expect(eptInfo[3]).to.equal(lockDuration);

            // do unlockAll
            let tx = await fundShareToken.unlockAll(alice.address);

            // check result
            eptInfo = await fundShareToken.getLockInfo(alice.address);
            expect(eptInfo[0]).to.equal(ADDRESS_ZERO);
            expect(eptInfo[1]).to.equal(0);
            expect(eptInfo[2]).to.equal(0);
            expect(eptInfo[3]).to.equal(0);

            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("Unlock");
            expect(eptEvent?.eventSignature)
                .to.equal("Unlock(address,address,uint256)");
            let amounts = eptEvent?.args;
            expect(amounts?.approver).to.equal(alice.address);
            expect(amounts?.locker).to.equal(owner.address);
            expect(amounts?.amount).to.equal(lockAmount);
        })

        it("unlockAll failed", async () => {
            let lockAmount = 300; let maxDuration = 86400; let lockDuration = 60;
            await fundShareToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            await fundShareToken.lock(alice.address, lockAmount, lockDuration);
            // caller is not the locker
            await expect(fundShareToken.connect(bob).unlockAll(alice.address, {from:bob.address}))
                .to.revertedWith("_msgSender is not locker of user");
        })

        it("unlock", async () => {
            let lockAmount = 300; let maxDuration = 86400; let lockDuration = 60;
            await fundShareToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            await fundShareToken.lock(alice.address, lockAmount, lockDuration);
            let _time = await latestTime();
            // check lockInfo
            let eptInfo = await fundShareToken.getLockInfo(alice.address);
            expect(eptInfo[0]).to.equal(owner.address);
            expect(eptInfo[1]).to.equal(lockAmount);
            expect(eptInfo[2]).to.equal(_time);
            expect(eptInfo[3]).to.equal(lockDuration);

            // do unlock
            let unlockAmount = 100;
            let tx = await fundShareToken.unlock(alice.address, unlockAmount);
            // check result
            eptInfo = await fundShareToken.getLockInfo(alice.address);
            expect(eptInfo[0]).to.equal(owner.address);
            expect(eptInfo[1]).to.equal(lockAmount - unlockAmount);
            expect(eptInfo[2]).to.equal(_time);
            expect(eptInfo[3]).to.equal(lockDuration);
            // check event
            let receipt = await tx.wait();
            let eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("Unlock");
            expect(eptEvent?.eventSignature)
                .to.equal("Unlock(address,address,uint256)");
            let amounts = eptEvent?.args;
            expect(amounts?.approver).to.equal(alice.address);
            expect(amounts?.locker).to.equal(owner.address);
            expect(amounts?.amount).to.equal(unlockAmount);

            // do unlock again
            unlockAmount = lockAmount - unlockAmount;
            tx = await fundShareToken.unlock(alice.address, unlockAmount);
            // check result
            eptInfo = await fundShareToken.getLockInfo(alice.address);
            expect(eptInfo[0]).to.equal(ADDRESS_ZERO);
            expect(eptInfo[1]).to.equal(0);
            expect(eptInfo[2]).to.equal(0);
            expect(eptInfo[3]).to.equal(0);
            // check event
            receipt = await tx.wait();
            eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("Unlock");
            expect(eptEvent?.eventSignature)
                .to.equal("Unlock(address,address,uint256)");
            amounts = eptEvent?.args;
            expect(amounts?.approver).to.equal(alice.address);
            expect(amounts?.locker).to.equal(owner.address);
            expect(amounts?.amount).to.equal(unlockAmount);

            // lock again for 60s
            await fundShareToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            await fundShareToken.lock(alice.address, lockAmount, 60);
            await advanceTimeAndBlock(100);  // exceed the duration
            tx = await fundShareToken.unlock(alice.address, 0); // unlock amount == 0
            // although unlock amount is 0, but it is out of duration, so it will unlockAll
            eptInfo = await fundShareToken.getLockInfo(alice.address);
            expect(eptInfo[0]).to.equal(ADDRESS_ZERO);
            expect(eptInfo[1]).to.equal(0);
            expect(eptInfo[2]).to.equal(0);
            expect(eptInfo[3]).to.equal(0);
            // check event
            receipt = await tx.wait();
            eptEvent = receipt?.events?.pop();
            expect(eptEvent?.event).to.equal("Unlock");
            expect(eptEvent?.eventSignature)
                .to.equal("Unlock(address,address,uint256)");
            amounts = eptEvent?.args;
            expect(amounts?.approver).to.equal(alice.address);
            expect(amounts?.locker).to.equal(owner.address);
            expect(amounts?.amount).to.equal(lockAmount);
        })

        it("unlock failed", async () => {
            let lockAmount = 300; let maxDuration = 86400; let lockDuration = 60;
            await fundShareToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            await fundShareToken.lock(alice.address, lockAmount, lockDuration);
            // caller is not the locker
            await expect(fundShareToken.connect(bob).unlock(alice.address, 100, {from:bob.address}))
                .to.revertedWith("_msgSender is not locker of user");

            // insufficient lock amount
            await expect(fundShareToken.unlock(alice.address, 666))
                .to.revertedWith("Exceeding the locked amount");
        })
    })
})
