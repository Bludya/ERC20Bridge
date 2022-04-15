
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils } = require("web3");

const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
const TEST_BYTES32 = ethers.utils.formatBytes32String('test');
const TEST_PREIMAGE = ethers.utils.hexZeroPad(utils.asciiToHex('test', 32), 32);
const HASH_FROM_PREIMAGE = utils.keccak256(TEST_PREIMAGE);

describe("BridgeGettersTest", function () {
    let bridgeFactory;
    let bridge;
    let coinFactory;
    let coin;
    before(async () => {
        coinFactory = await ethers.getContractFactory("MintableERC20");
        coin = await coinFactory.deploy("TST", "Test coin");
        await coin.deployed();
        bridgeFactory = await ethers.getContractFactory("ERC20Bridge");
        bridge = await bridgeFactory.deploy(1);
        await bridge.deployed();
    });

    it("Should return empty set before coin is added", async () => {
        expect((await bridge.getAvailableCoins()).length).to.equal(0);
    });

    it("Should return lockbridge is missing when given missing id", async () => {
        expect((await bridge.destinationExists(coin.address)));
    });

    it("Should return empty destination address by id before added", async () => {
        expect((await bridge.getDstCoinByBridgelockId(TEST_BYTES32))).to.equal(EMPTY_ADDRESS);
    });

    it("Should return empty destination address by address before added", async () => {
        expect((await bridge.getDstCoin(coin.address))).to.equal(EMPTY_ADDRESS);
    });

    it("Should return zero chainId when destination not added", async () => {
        expect((await bridge.getDestToOriginChainId(coin.address))).to.equal(0);
    });

    it("Should return array with one entry when coin added", async () => {
        await bridge.addCoin(coin.address);
        const coins = await bridge.getAvailableCoins();
        expect(coins.length).to.equal(1);
        expect(coins[0]).to.equal(coin.address);
    })

    it("Deploy coin should add coin to destination addresses", async () => {
        const coin2 = await coinFactory.deploy('TST2', 'Test coin 2');
        await bridge.deployCoin(2, coin2.address, 'bTST', 'Bridged testcoin');
        expect(await bridge.getDstCoin(coin2.address)).to.not.equal(EMPTY_ADDRESS);
    })

    it("Deploy coin should add coin to coin array", async () => {
        const coin2 = await coinFactory.deploy('TST2', 'Test coin 2');
        await bridge.deployCoin(2, coin2.address, 'bTST', 'Bridged testcoin');
        const coins = await bridge.getAvailableCoins();
        const deployedCoinAddr = await bridge.getDstCoin(coin2.address);

        expect(coins.length).to.equal(3);
        expect(coins[2]).to.equal(deployedCoinAddr);
    })

    it("Deploy coin should add destination", async () => {
        const coin2 = await coinFactory.deploy('TST2', 'Test coin 2');
        await bridge.deployCoin(2, coin2.address, 'bTST', 'Bridged testcoin');
        expect(await bridge.destinationExists(coin2.address));
    })

    it("Add destination should add destination with same chainId", async () => {
        const srcChainId = 2
        const coin2 = await coinFactory.deploy('TST2', 'Test coin 2');
        await bridge.deployCoin(srcChainId, coin2.address, 'bTST', 'Bridged testcoin');
        const deployedCoinAddr = await bridge.getDstCoin(coin2.address);
        expect(await bridge.getDestToOriginChainId(deployedCoinAddr)).to.equal(srcChainId);
    })
    
    it("Add destination should add coin to destination addresses", async () => {
        const coin2 = await coinFactory.deploy('TST2', 'Test coin 2');
        const coin3 = await coinFactory.deploy('TST3', 'Test coin 2');
        await bridge.addDestination(coin3.address, coin2.address);
        expect(await bridge.destinationExists(coin2.address));
    })

    it("Add destination should add coin to destination with expected source", async () => {
        const deployedCoin = await coinFactory.deploy('TST2', 'Test coin 2');
        const originalCoin = await coinFactory.deploy('TST3', 'Test coin 2');
        await bridge.addDestination(deployedCoin.address, originalCoin.address);
        expect(await bridge.getDstCoin(deployedCoin.address)).to.equal(originalCoin.address);
    })
})