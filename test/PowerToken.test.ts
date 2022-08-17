import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { PowerTokenMock } from "../typechain";
import { advanceTimeAndBlock, latestTime } from "./utilities/time";

const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
async function withDecimals18(amount: number) {
  return BigNumber.from(amount).mul(BigNumber.from(10).pow(18)).toString();
}

describe("PowerToken contract test", function () {

    let powerToken: PowerTokenMock;

    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let addrs: SignerWithAddress[];
    beforeEach(async () => {
        [owner, alice, bob, ...addrs] = await ethers.getSigners();
        const PowerTok_ = await ethers.getContractFactory("PowerTokenMock", owner);

        powerToken = await PowerTok_.deploy();
        await powerToken.deployed();
        await powerToken["initialize(string,string,address,address[])"](
            "PowerToken",
            "PT",
            owner.address,
            [owner.address, alice.address],
        );
    })

    it("initialize", async () => {
        let balanceString = await withDecimals18(1);
        const ownerBalance = (await powerToken.balanceOf(owner.address)).toString();
        const aliceBalance = (await powerToken.balanceOf(alice.address)).toString();
        const ownerAllowance = (await powerToken.allowance(owner.address, owner.address)).toString();
        const aliceAllowance = (await powerToken.allowance(alice.address, owner.address)).toString();
        expect(ownerBalance).to.equal(balanceString);
        expect(aliceBalance).to.equal(balanceString);
        expect(ownerAllowance).to.equal(balanceString);
        expect(aliceAllowance).to.equal(balanceString);
        expect(await powerToken.balanceOf(bob.address)).to.equal(0);
        expect(await powerToken.fundAddress()).to.equal(owner.address);
    })

    describe("functions test", function () {
        it("setCanTransferFlag", async () => {
            expect(await powerToken.canTransfer()).to.equal(false);
            await powerToken.setCanTransferFlag(true);
            expect(await powerToken.canTransfer()).to.equal(true);
        })

        it("setCanTransferFlag failed", async () => {
            await expect(powerToken.connect(alice).setCanTransferFlag(true, {from:alice.address}))
                .to.revertedWith("Ownable: caller is not the owner");
        })

        it("mint", async () => {
            // pre state
            let balanceString = await withDecimals18(1);
            let aliceBalance = (await powerToken.balanceOf(alice.address)).toString();
            expect(aliceBalance).to.equal(balanceString);
            expect(await powerToken.balanceOf(bob.address)).to.equal(0);

            // do call
            let bobBalance = 200;
            await powerToken.mint(alice.address, BigNumber.from(1).mul(BigNumber.from(10).pow(18)));
            await powerToken.mint(bob.address, bobBalance);

            // check balance
            balanceString = await withDecimals18(2);
            aliceBalance = (await powerToken.balanceOf(alice.address)).toString();
            expect(aliceBalance).to.equal(balanceString);
            expect(await powerToken.balanceOf(bob.address)).to.equal(bobBalance);
            // check allowance
            let aliceAllowance = (await powerToken.allowance(alice.address, owner.address)).toString();
            let bobAllowance = await powerToken.allowance(bob.address, owner.address);
            // TODO: alice's allowance should be 2* 10**18
            // expect(aliceAllowance).to.equal(balanceString);
            expect(bobAllowance).to.equal(bobBalance);
        })

        it("mint failed", async () => {
            // not MINTER_ROLE
            // await expect(powerToken.connect(alice).mint(alice.address, 100000, {from:alice.address}))
            //     .to.revertedWith("ERC20PresetMinterPauser: must have minter role to mint");
            await expect(powerToken.connect(alice).mint(alice.address, 100000, {from:alice.address}))
                .to.revertedWith("Only Fund can call");
        })

        it("burn", async () => {
            // pre state
            let balanceString = await withDecimals18(1);
            let aliceBalance = (await powerToken.balanceOf(alice.address)).toString();
            expect(aliceBalance).to.equal(balanceString);

            // do burn
            await powerToken.setCanTransferFlag(true);
            await powerToken.connect(alice).burn(
                BigNumber.from(1).mul(BigNumber.from(10).pow(18)), {from:alice.address});
            // check result: 1e18 - 1e18 = 0
            expect(await powerToken.balanceOf(alice.address)).to.equal(0);
        })

        it("burn failed", async () => {
            let lockAmount = 300; let maxDuration = 86400; let lockDuration = 60;
            await powerToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            await powerToken.lock(alice.address, lockAmount, lockDuration);

            // not enough balance after lock
            await expect(powerToken.connect(alice)
                .burn(BigNumber.from(1).mul(BigNumber.from(10).pow(18)), {from:alice.address}))
                .to.revertedWith("The amount transferred exceeds the balance after locked");

            // `canTransfer` is false
            await powerToken.unlockAll(alice.address);
            await expect(powerToken.connect(alice)
                .burn(BigNumber.from(1).mul(BigNumber.from(10).pow(18)), {from:alice.address}))
                .to.revertedWith("Cannot transfer");
        })

        it("burnFrom", async () => {
            // pre state
            let balanceString = await withDecimals18(1);
            let aliceBalance = (await powerToken.balanceOf(alice.address)).toString();
            expect(aliceBalance).to.equal(balanceString);
            // do burn
            await powerToken.connect(alice).approve(
                owner.address, BigNumber.from(1).mul(BigNumber.from(10).pow(18)));
            await powerToken.burnFrom(
                alice.address, BigNumber.from(1).mul(BigNumber.from(10).pow(18)));
            // check result: 1e18 - 1e18 = 0
            expect(await powerToken.balanceOf(alice.address)).to.equal(0);
        })

        it("burnFrom failed", async () => {
            let lockAmount = 300; let maxDuration = 86400; let lockDuration = 60;
            await powerToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            await powerToken.lock(alice.address, lockAmount, lockDuration);

            // no enough balance after lock
            await expect(powerToken
                .burnFrom(alice.address, BigNumber.from(1).mul(BigNumber.from(10).pow(18))))
                .to.revertedWith("The amount transferred exceeds the balance after locked");

            // not fundAddress
            await powerToken.unlockAll(alice.address);
            await expect(powerToken.connect(bob)
                .burnFrom(alice.address, BigNumber.from(1).mul(BigNumber.from(10).pow(18)), {from:bob.address}))
                .to.revertedWith("Only Fund can call");
        })

        it("transfer", async () => {
            // pre state
            let balanceString = await withDecimals18(1);
            let aliceBalance = (await powerToken.balanceOf(alice.address)).toString();
            expect(aliceBalance).to.equal(balanceString);
            expect(await powerToken.balanceOf(bob.address)).to.equal(0);

            // do call
            await powerToken.setCanTransferFlag(true);
            await powerToken.connect(alice).transfer(
                bob.address, BigNumber.from(1).mul(BigNumber.from(10).pow(18)), {from:alice.address});

            // check balance
            expect((await powerToken.balanceOf(bob.address)).toString()).to.equal(balanceString);
            expect(await powerToken.balanceOf(alice.address)).to.equal(0);
        })

        it("transfer failed", async () => {
            // not allow
            await expect(powerToken.transfer(bob.address, 100000)).to.revertedWith("Cannot transfer");

            await powerToken.setCanTransferFlag(true);
            let lockAmount = 300; let maxDuration = 86400; let lockDuration = 60;
            await powerToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            await powerToken.lock(alice.address, lockAmount, lockDuration);
            // insufficient balance available
            await expect(powerToken.connect(alice)
                .transfer(bob.address, BigNumber.from(1).mul(BigNumber.from(10).pow(18)), {from:alice.address}))
                .to.revertedWith("The amount transferred exceeds the balance after locked");
        })


        it("transferFrom", async () => {
            // pre state
            let balanceString = await withDecimals18(1);
            let aliceBalance = (await powerToken.balanceOf(alice.address)).toString();
            expect(aliceBalance).to.equal(balanceString);
            expect(await powerToken.balanceOf(bob.address)).to.equal(0);

            // do call
            await powerToken.setCanTransferFlag(true);
            await powerToken.connect(alice).approve(
                owner.address, BigNumber.from(1).mul(BigNumber.from(10).pow(18)));
            await powerToken.transferFrom(
                alice.address, bob.address, BigNumber.from(1).mul(BigNumber.from(10).pow(18)));

            // check balance
            expect((await powerToken.balanceOf(bob.address)).toString()).to.equal(balanceString);
            expect(await powerToken.balanceOf(alice.address)).to.equal(0);
        })

        it("transferFrom failed", async () => {
            // not allow
            await expect(powerToken.transferFrom(alice.address, bob.address, 100000))
                .to.revertedWith("Cannot transfer");

            await powerToken.setCanTransferFlag(true);
            let lockAmount = 300; let maxDuration = 86400; let lockDuration = 60;
            await powerToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            await powerToken.lock(alice.address, lockAmount, lockDuration);
            await powerToken.connect(alice).approve(
                owner.address, BigNumber.from(1).mul(BigNumber.from(10).pow(18)));
            // insufficient balance available
            await expect(powerToken
                .transferFrom(alice.address, bob.address, BigNumber.from(1).mul(BigNumber.from(10).pow(18))))
                .to.revertedWith("The amount transferred exceeds the balance after locked");
        })

        it("approveLock", async () => {
            let lockAmount = 300; let maxDuration = 86400;
            let tx = await powerToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});

            // check result
            let eptInfo = await powerToken.getApproveLockInfo(alice.address);
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
            // insufficient balance, bob's balance is zero
            await expect(powerToken.connect(bob).approveLock(owner.address, 100, 3600, {from:bob.address}))
                .to.revertedWith("the amount of approve need LT balance of _msgSender");

            // there is still amount locked
            await powerToken.connect(alice).approveLock(owner.address, 100, 3600, {from:alice.address});
            await powerToken.lock(alice.address, 100, 60);
            await expect(powerToken.connect(alice)
                .approveLock(owner.address, 200, 60, {from:alice.address}))
                .to.revertedWith("Not meet approve lock condition");
        })

        it("lock", async () => {
            let lockAmount = 300; let maxDuration = 86400; let lockDuration = 60;
            await powerToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            let tx = await powerToken.lock(alice.address, lockAmount, lockDuration);
            let _time = await latestTime();

            // check approveLockInfo
            let eptInfo = await powerToken.getApproveLockInfo(alice.address);
            expect(eptInfo[0]).to.equal(owner.address);
            expect(eptInfo[1]).to.equal(lockAmount - lockAmount);
            expect(eptInfo[2]).to.equal(maxDuration);
            // check lockInfo
            let eptInfo2 = await powerToken.getLockInfo(alice.address);
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
            await expect(powerToken.lock(bob.address, 1000, 60)).to.revertedWith("Exceeding balance");

            // no locker, means locker is not owner.address
            await expect(powerToken.lock(alice.address, 100, 60)).to.revertedWith("_msgSender is not locker of user");

            // lockApprove amount must GT amount
            await powerToken.connect(alice).approveLock(owner.address, 100, 3600, {from:alice.address});
            await expect(powerToken.lock(alice.address, 200, 60)).to.revertedWith("Exceeding the maximum amount");

            // lockApprove duration must GT duration
            await expect(powerToken.lock(alice.address, 100, 6000)).to.revertedWith("Exceeding the maximum duration");

            // there is still amount locked
            await powerToken.lock(alice.address, 50, 60);
            await expect(powerToken.lock(alice.address, 50, 60))
                .to.revertedWith("amount == 0 or passed duration");
        })

        it("increaseLockAmount", async () => {
            let lockAmount = 300; let _amount = 100; let maxDuration = 86400; let lockDuration = 60;
            await powerToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            await powerToken.lock(alice.address, _amount, lockDuration);
            let _time = await latestTime();
            // approveLockInfo
            let eptInfo = await powerToken.getApproveLockInfo(alice.address);
            expect(eptInfo[0]).to.equal(owner.address);
            expect(eptInfo[1]).to.equal(lockAmount - _amount);
            expect(eptInfo[2]).to.equal(maxDuration);
            // lockInfo
            let eptInfo2 = await powerToken.getLockInfo(alice.address);
            expect(eptInfo2[0]).to.equal(owner.address);
            expect(eptInfo2[1]).to.equal(_amount);
            expect(eptInfo2[2]).to.equal(_time);
            expect(eptInfo2[3]).to.equal(lockDuration);

            // do increaseLockAmount
            let tx = await powerToken.increaseLockAmount(alice.address, lockAmount - _amount);
            // approveLockInfo
            eptInfo = await powerToken.getApproveLockInfo(alice.address);
            expect(eptInfo[0]).to.equal(owner.address);
            expect(eptInfo[1]).to.equal(0);
            expect(eptInfo[2]).to.equal(maxDuration);
            // lockInfo
            eptInfo2 = await powerToken.getLockInfo(alice.address);
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
            expect(amounts?.duration).to.equal(0);
            expect(amounts?.amount).to.equal(lockAmount - _amount);
        })

        it("increaseLockAmount failed", async () => {
            // no locker, means locker is not owner.address
            await expect(powerToken.increaseLockAmount(alice.address, 100)).to.revertedWith("_msgSender is not locker of user");

            // out of approval amount
            await powerToken.connect(alice).approveLock(owner.address, 600, 3600, {from:alice.address});
            await powerToken.lock(alice.address, 10, 60);
            await expect(powerToken.increaseLockAmount(alice.address, 591)).to.revertedWith("Exceeding the maximum amount");
            await powerToken.unlockAll(alice.address);

            // not in locking state
            // lock amount is 0
            await powerToken.lock(alice.address, 0, 60);
            await expect(powerToken.increaseLockAmount(alice.address, 50)).to.revertedWith("Need on locking status now");
            // lock duration is 0
            await powerToken.lock(alice.address, 50, 0);
            await expect(powerToken.increaseLockAmount(alice.address, 50)).to.revertedWith("Need on locking status now");
            await powerToken.unlockAll(alice.address);
            // exceed the duration
            await powerToken.lock(alice.address, 50, 50);
            await advanceTimeAndBlock(100);
            await expect(powerToken.increaseLockAmount(alice.address, 50)).to.revertedWith("Need on locking status now");
            await powerToken.unlockAll(alice.address);

            // exceeding balance
            await powerToken.mint(bob.address, 1000);
            await powerToken.connect(bob).approveLock(owner.address, 600, 3600, {from:bob.address});
            await powerToken.lock(bob.address, 10, 60);
            await powerToken.setCanTransferFlag(true);
            await powerToken.connect(bob).transfer(
                alice.address, 500, {from:bob.address});
            await expect(powerToken.increaseLockAmount(bob.address, 590)).to.revertedWith("Exceeding balance");
        })

        it("unlockAll", async () => {
            let lockAmount = 300; let maxDuration = 86400; let lockDuration = 60;
            await powerToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            await powerToken.lock(alice.address, lockAmount, lockDuration);
            let _time = await latestTime();
            // check lockInfo
            let eptInfo = await powerToken.getLockInfo(alice.address);
            expect(eptInfo[0]).to.equal(owner.address);
            expect(eptInfo[1]).to.equal(lockAmount);
            expect(eptInfo[2]).to.equal(_time);
            expect(eptInfo[3]).to.equal(lockDuration);

            // do unlockAll
            let tx = await powerToken.unlockAll(alice.address);

            // check result
            eptInfo = await powerToken.getLockInfo(alice.address);
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
            await powerToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            await powerToken.lock(alice.address, lockAmount, lockDuration);
            // caller is not the locker
            await expect(powerToken.connect(bob).unlockAll(alice.address, {from:bob.address}))
                .to.revertedWith("_msgSender is not locker of user");
        })

        it("unlock", async () => {
            let lockAmount = 300; let maxDuration = 86400; let lockDuration = 600;
            await powerToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            await powerToken.lock(alice.address, lockAmount, lockDuration);
            let _time = await latestTime();
            // check lockInfo
            let eptInfo = await powerToken.getLockInfo(alice.address);
            expect(eptInfo[0]).to.equal(owner.address);
            expect(eptInfo[1]).to.equal(lockAmount);
            expect(eptInfo[2]).to.equal(_time);
            expect(eptInfo[3]).to.equal(lockDuration);

            // do unlock
            let unlockAmount = 100;
            let tx = await powerToken.unlock(alice.address, unlockAmount);
            // check result
            eptInfo = await powerToken.getLockInfo(alice.address);
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
            tx = await powerToken.unlock(alice.address, unlockAmount);
            // check result
            eptInfo = await powerToken.getLockInfo(alice.address);
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
            await powerToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            await powerToken.lock(alice.address, lockAmount, 60);
            await advanceTimeAndBlock(100);  // exceed the duration
            tx = await powerToken.unlock(alice.address, 0); // unlock amount == 0
            // although unlock amount is 0, but it is out of duration, so it will unlockAll
            eptInfo = await powerToken.getLockInfo(alice.address);
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
            await powerToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            await powerToken.lock(alice.address, lockAmount, lockDuration);
            // caller is not the locker
            await expect(powerToken.connect(bob).unlock(alice.address, 100, {from:bob.address}))
                .to.revertedWith("_msgSender is not locker of user");

            // insufficient lock amount
            await expect(powerToken.unlock(alice.address, 666))
                .to.revertedWith("Exceeding the locked amount");
        })

        it("lockAmountOf", async () => {
            // pre state
            expect(await powerToken.lockAmountOf(alice.address)).to.equal(0);
            // lock
            let lockAmount = 300; let maxDuration = 86400; let lockDuration = 60;
            await powerToken.connect(alice).approveLock(owner.address, lockAmount, maxDuration, {from:alice.address});
            await powerToken.lock(alice.address, lockAmount, lockDuration);
            // check lock amount
            expect(await powerToken.lockAmountOf(alice.address)).to.equal(lockAmount);
            await advanceTimeAndBlock(100);
            expect(await powerToken.lockAmountOf(alice.address)).to.equal(0);
        })
    })
})
