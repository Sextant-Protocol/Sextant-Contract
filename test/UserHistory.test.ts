import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { UserHistoryMock } from "../typechain";
import { latestTime } from "./utilities/time";

describe("UserHistory contract test", function () {

    let userHistory: UserHistoryMock;
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let addrs: SignerWithAddress[];
    beforeEach(async () => {
        [owner, alice, bob, ...addrs] = await ethers.getSigners();
        const UserHis_ = await ethers.getContractFactory("UserHistoryMock", owner);

        userHistory = await UserHis_.deploy();
        await userHistory.deployed();
    })

    it("initialize", async () => {
        await userHistory.initialize();
        expect(await userHistory.owner()).to.equal(owner.address);
    })

    describe("functions test", function () {
        beforeEach(async () => {
            await userHistory.initialize();
        })

        it("writeNewHistory", async () => {
            let _operateId = 1; let _fundNo = 2; let _amounts = [3, 4];

            // pre state
            await userHistory.setInternalCaller(owner.address, true);
            expect(await userHistory.internalCaller(owner.address)).to.equal(true);
            expect(await userHistory.getUserOpHistoryLen(owner.address)).to.equal(0);

            // do call
            await userHistory.writeNewHistory(
                owner.address, _operateId, _fundNo, _amounts, [alice.address, bob.address]
            );
            let _time = await latestTime();

            // check result
            // check userOpHistory
            let infoLen = (await userHistory.getUserOpHistoryLen(owner.address)).toNumber();
            expect(infoLen).to.equal(1);
            let eptInfo = await userHistory.getOperationInfo(owner.address, infoLen - 1);
            expect(eptInfo[0]).to.equal(_fundNo);
            expect(eptInfo[1]).to.equal(_operateId);
            expect(eptInfo[2]).to.equal(_time);
            // check userHistoryTokenInfo
            let tokenInfo = await userHistory.getUserHistoryTokenInfo(owner.address, infoLen - 1);
            expect(tokenInfo[0].token).to.equal(alice.address);
            expect(tokenInfo[0].amount).to.equal(_amounts[0]);
            expect(tokenInfo[1].token).to.equal(bob.address);
            expect(tokenInfo[1].amount).to.equal(_amounts[1]);
        })

        it("writeNewHistory failed", async () => {
            // not internal caller
            await expect(userHistory.writeNewHistory(
                owner.address, 1, 1, [2,3], [alice.address, bob.address]
            )).to.revertedWith("Internalable: caller is not a internal caller");
        })

        it("setInternalCaller", async () => {
            expect(await userHistory.internalCaller(owner.address)).to.equal(false);
            await userHistory.setInternalCaller(owner.address, true);
            expect(await userHistory.internalCaller(owner.address)).to.equal(true);
        })

        it("setInternalCaller failed", async () => {
            await expect(userHistory.connect(bob)
                .setInternalCaller(bob.address, true, {from: bob.address}))
                .to.revertedWith("Ownable: caller is not the owner");
        })
    })
})
