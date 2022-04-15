
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils } = require("web3");

const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
const TEST_BYTES32 = ethers.utils.formatBytes32String('test');
const TEST_PREIMAGE = ethers.utils.hexZeroPad(utils.asciiToHex('test', 32), 32);
const HASH_FROM_PREIMAGE = utils.keccak256(TEST_PREIMAGE);


const TEST_BRIDGELOCK = {
    id: TEST_BYTES32,
    srcCoin: EMPTY_ADDRESS,
    receiver: EMPTY_ADDRESS,
    amount: 1,
    hashLock: HASH_FROM_PREIMAGE,
    srcChainId: 1,
    dstChainId: 2,
    isThisSrc: true,
}

describe("BridgeErrorsTest", function () {
    let errorBridgeFactory;
    let errorBridge;
    let errorCoinFactory;
    let errorCoin;
    before(async () => {
        errorCoinFactory = await ethers.getContractFactory("MintableERC20");
        errorCoin = await errorCoinFactory.deploy("TST", "Test coin");
        await errorCoin.deployed();
        errorBridgeFactory = await ethers.getContractFactory("ERC20Bridge");
        errorBridge = await errorBridgeFactory.deploy(TEST_BRIDGELOCK.srcChainId);
        await errorBridge.deployed();
    });

    it("bridgeCoin should throw src same as destination error", async () => {
        const [owner] = await ethers.getSigners();
        expect(errorBridge.bridgeCoin(
            TEST_BRIDGELOCK.srcCoin,
            owner.address,
            TEST_BRIDGELOCK.amount,
            TEST_BRIDGELOCK.hashLock,
            TEST_BRIDGELOCK.srcChainId,
        )).to.revertedWith("Source chain id can't be the same as destination chain id");
    });

    it("bridgeCoin should throw negative amount error", async () => {
        expect(errorBridge.bridgeCoin(
            TEST_BRIDGELOCK.srcCoin,
            TEST_BRIDGELOCK.receiver,
            0,
            TEST_BRIDGELOCK.hashLock,
            TEST_BRIDGELOCK.dstChainId,
        )).to.revertedWith("token amount must be > 0");
    });

    it("bridgeBurnCoin should throw src same as destination error", async () => {
        const [owner] = await ethers.getSigners();
        expect(errorBridge.bridgeBurnCoin(
            TEST_BRIDGELOCK.srcCoin,
            owner.address,
            TEST_BRIDGELOCK.amount,
            TEST_BRIDGELOCK.hashLock,
            TEST_BRIDGELOCK.srcChainId,
        )).to.revertedWith("Source chain id can't be the same as destination chain id");
    });

    it("bridgeBurnCoin should throw negative amount error", async () => {
        expect(errorBridge.bridgeBurnCoin(
            TEST_BRIDGELOCK.srcCoin,
            TEST_BRIDGELOCK.receiver,
            0,
            TEST_BRIDGELOCK.hashLock,
            TEST_BRIDGELOCK.dstChainId,
        )).to.revertedWith("token amount must be > 0");
    });

    it("deployCoin should throw coin exists error", async () => {
        await errorBridge.deployCoin(2, errorCoin.address, 'bTST', 'Bridged testcoin');
        expect(errorBridge.deployCoin(2, errorCoin.address, 'bTST', 'Bridged testcoin')).to.revertedWith("Contract already exists for this source");
    });

    it("addDestination should throw coin exists error", async () => {
        expect(errorBridge.addDestination(errorCoin.address, errorCoin.address)).to.revertedWith("Contract already exists for this source");
    });

    it("releaseTransferCoin should throw msg.sender not bridgelock receiver error", async () => {
        expect(errorBridge.releaseTransferCoin(TEST_BYTES32, TEST_PREIMAGE)).to.revertedWith("msg.sender != bridge.receiver");
    });

    it("releaseMintCoin should throw msg.sender not bridgelock receiver error", async () => {
        expect(errorBridge.releaseMintCoin(TEST_BYTES32, TEST_PREIMAGE)).to.revertedWith("msg.sender != bridge.receiver");
    });

    it("refundMint should throw msg.sender not bridgelock receiver error", async () => {
        expect(errorBridge.refundMint(TEST_BYTES32, TEST_PREIMAGE)).to.revertedWith("msg.sender != bridge.sender");
    });

    it("refundTransfer should throw msg.sender not bridgelock receiver error", async () => {
        expect(errorBridge.refundTransfer(TEST_BYTES32, TEST_PREIMAGE)).to.revertedWith("msg.sender != bridge.sender");
    });
})