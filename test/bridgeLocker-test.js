
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils } = require("web3");

const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
const TEST_BYTES32 = ethers.utils.formatBytes32String('test');
const TEST_PREIMAGE = ethers.utils.hexZeroPad(utils.asciiToHex('test', 32), 32);
const HASH_FROM_PREIMAGE = utils.keccak256(TEST_PREIMAGE);
const EMPTY_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';


const TEST_BRIDGELOCK = {
    id: TEST_BYTES32,
    srcCoin: EMPTY_ADDRESS,
    receiver: EMPTY_ADDRESS,
    amount: 1,
    hashLock: HASH_FROM_PREIMAGE,
    srcChainId: 1,
    dstChainId: 2,
}

describe("BridgeLocker", function () {
    let bridgeLockerFactory;
    let bridgeLocker;
    before(async () => {
        bridgeLockerFactory = await ethers.getContractFactory("ExposedBridgeLocker");
        bridgeLocker = await bridgeLockerFactory.deploy();
        await bridgeLocker.deployed();
    });

    it("Should return empty set before any bridge is created", async () => {
        expect((await bridgeLocker.getBridgeLocks()).length).to.equal(0);
    });

    it("Should return lockbridge is missing when given missing id", async () => {
        expect(bridgeLocker.lockBridge(TEST_BYTES32, TEST_BYTES32)).to.be.revertedWith('bridge does not exist');
    });

    it("Should create bridgelock successfully", async () => {
        const [owner] = await ethers.getSigners();
        expect(bridgeLocker._addBridgeLock(
            TEST_BRIDGELOCK.id,
            TEST_BRIDGELOCK.srcCoin,
            owner.address,
            TEST_BRIDGELOCK.receiver,
            TEST_BRIDGELOCK.amount,
            TEST_BRIDGELOCK.hashLock,
            TEST_BRIDGELOCK.srcChainId,
            TEST_BRIDGELOCK.dstChainId,
        )).to.not.revertedWith("Source chain id can't be the same as destination chain id");
    });

    it("Should throw same bridgeLock id error", async () => {
        const [owner] = await ethers.getSigners();
        expect(bridgeLocker._addBridgeLock(
            TEST_BRIDGELOCK.id,
            TEST_BRIDGELOCK.srcCoin,
            owner.address,
            TEST_BRIDGELOCK.receiver,
            TEST_BRIDGELOCK.amount,
            TEST_BRIDGELOCK.hashLock,
            TEST_BRIDGELOCK.srcChainId,
            TEST_BRIDGELOCK.dstChainId,
        )).to.revertedWith("bridge already exists exist");
    });

    it("Should return an array with one entry after bridge created", async () => {
        expect((await bridgeLocker.getBridgeLocks()).length).to.equal(1);
    });

    it("Should return BridgeLock with correct data", async () => {
        const [owner] = await ethers.getSigners();
        const bridgeLock = (await bridgeLocker.getBridgeLocks())[0];

        expect(bridgeLock.hashlock).to.equal(TEST_BRIDGELOCK.hashLock);
        expect(bridgeLock.preimage).to.equal(EMPTY_BYTES32);
        expect(bridgeLock.srcChainId).to.equal(TEST_BRIDGELOCK.srcChainId);
        expect(bridgeLock.dstChainId).to.equal(TEST_BRIDGELOCK.dstChainId);
        expect(bridgeLock.coin).to.equal(TEST_BRIDGELOCK.srcCoin);
        expect(bridgeLock.sender).to.equal(owner.address);
        expect(bridgeLock.receiver).to.equal(TEST_BRIDGELOCK.receiver);
        expect(bridgeLock.amount).to.equal(TEST_BRIDGELOCK.amount);
        expect(bridgeLock.active);
    });

    it("Should be reverted when given incorrect preimage", async () => {
        const bridgeLockid = (await bridgeLocker.getBridgeLocks())[0].id;
        expect(bridgeLocker.lockBridge(bridgeLockid, TEST_BYTES32)).to.revertedWith("hashlock hash does not match");
    });

    it("Should change active to false and add preimage when lockBridge called", async () => {
        const bridgeLockid = (await bridgeLocker.getBridgeLocks())[0].id;
        await bridgeLocker.lockBridge(bridgeLockid, TEST_PREIMAGE);
        const bridgeLock = (await bridgeLocker.getBridgeLocks())[0];
        expect(!bridgeLock.active);
        expect(bridgeLock.preimage).to.equal(TEST_PREIMAGE);
    });

    it("Should revert when trying to lock inactive bridgeLock", async () => {
        const bridgeLockid = (await bridgeLocker.getBridgeLocks())[0].id;
        expect(bridgeLocker.lockBridge(bridgeLockid, TEST_PREIMAGE)).to.revertedWith("BridgeLock already inactive");
    });
})