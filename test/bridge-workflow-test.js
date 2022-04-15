
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils } = require("web3");
const BigNumber = require("big-number");

const MintableERC20  = require("../artifacts/contracts/MintableERC20.sol/MintableERC20.json");

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

describe("BridgeTest", function () {
    let bridgeFactory;
    let srcBridge;
    let dstBridge;
    let coinFactory;
    let coin;
    let bridgeLock;
    let dstCoinAddr;

    before(async () => {
        const [owner] = await ethers.getSigners();
        TEST_BRIDGELOCK.receiver = owner.address;
        TEST_BRIDGELOCK.sender = owner.address;
        
        coinFactory = await ethers.getContractFactory("ValCoin");
        coin = await coinFactory.deploy("TST", "Test coin");
        await coin.deployed();
        TEST_BRIDGELOCK.srcCoin = coin.address;

        bridgeFactory = await ethers.getContractFactory("ERC20Bridge");
        srcBridge = await bridgeFactory.deploy(TEST_BRIDGELOCK.srcChainId);
        await srcBridge.deployed();

        dstBridge = await bridgeFactory.deploy(TEST_BRIDGELOCK.dstChainId);
        await dstBridge.deployed();

        //admin adds a coin that is available to the users to bridge
        //with ValCoin it also mints some tokens to test to the sender address
        await srcBridge.addCoin(coin.address)
    });

    it("should have a coin added", async () => {
        expect((await srcBridge.getAvailableCoins()).length).to.equal(1);
    })

    //user selects a coin and the ui checks if the coin is original
    it("srcBridge isCoinOriginal should return true", async () => {
        expect(await srcBridge.isCoinOriginal(coin.address)).to.equal(true);
    })

    //since coin is original bridgeCoin function is used
    it("bridgeCoin should emit CoinBridged event", async () => {
        await coin.approve(srcBridge.address, TEST_BRIDGELOCK.amount);
        expect(srcBridge.bridgeCoin(
            TEST_BRIDGELOCK.srcCoin,
            TEST_BRIDGELOCK.receiver,
            TEST_BRIDGELOCK.amount,
            TEST_BRIDGELOCK.hashLock,
            TEST_BRIDGELOCK.dstChainId,
        )).to.emit(srcBridge, "CoinBridged");
        TEST_BRIDGELOCK.id = (await srcBridge.getBridgeLocks())[0].id;
    });

    //when the event is emitted the validator sees it and checks if the
    //coin bridged is original or a bridged one
    //in this case it should be original
    it("bridgeLock should be with isThisSrc flag set to true", async () => {
        bridgeLock = await srcBridge.getBridgeLock(TEST_BRIDGELOCK.id);
        expect(await srcBridge.isCoinOriginal(bridgeLock.coin)).to.equal(true);
    })

    //also the validator needs to know if the destination bridge 
    //has a destination coin set for this source
    //in this case it should not have a destination
    it("destinationExists should return false", async () => {
        expect(await dstBridge.destinationExists(bridgeLock.coin)).to.equal(false);
    })

    //since the destination bridge does not have a destination coin for this source
    //and the bridged coin is an original one
    //validator calls deploy coin
    it("deployCoin should add destination coin for source", async () => {
        await dstBridge.deployCoin(
            TEST_BRIDGELOCK.srcChainId, 
            TEST_BRIDGELOCK.srcCoin, 
            await coin.symbol(),
            await coin.name(),
        );

        expect(await dstBridge.destinationExists(bridgeLock.coin)).to.equal(true);
    })

    //add the destination coin address to the source bridge as well
    //so it can know what to bridge back to
    it("addDestination should add deployed contract and its source as its destination", async () => {
        dstCoinAddr = dstBridge.getDstCoin(TEST_BRIDGELOCK.srcCoin);
        await srcBridge.addDestination(dstCoinAddr, TEST_BRIDGELOCK.srcCoin);
        expect(await srcBridge.destinationExists(dstCoinAddr)).to.equal(true);
    })

    //now when everything is prepared validator adds release on dst contract
    it("addRelease should emit ReleaseAdded with correct id", async () => {
        expect(dstBridge.addRelease(
            bridgeLock.id,
            bridgeLock.srcChainId,
            bridgeLock.coin,
            bridgeLock.sender,
            bridgeLock.receiver,
            bridgeLock.amount,
            bridgeLock.hashlock
        )).to.emit(dstBridge, "ReleaseAdded").withArgs(bridgeLock.id);
    })

    //when the validator receives the releaseAdded event
    //he checks if the coin is src for the source bridge
    //it is since it was checked above and here it would be the same

    //now the user can release the coins on the target chain
    //since the coin is a original => bridged the frontend will call releaseMintCoin
    it("releaseMintCoin should emit CoinReleased and mint coin", async () => {
        expect(await dstBridge.releaseMintCoin(bridgeLock.id, TEST_PREIMAGE))
        .to.emit(dstBridge, "CoinReleased")
        .withArgs(bridgeLock.id, TEST_PREIMAGE);
        
        const accounts = await hre.ethers.getSigners();
        const deployedCoinContract = ethers.ContractFactory.getContract(dstCoinAddr, MintableERC20.abi, accounts[0]);
        expect(await deployedCoinContract.balanceOf(bridgeLock.receiver)).to.equal(bridgeLock.amount);
   })
})

describe("BridgeBackTest", function () {
    let bridgeFactory;
    let srcBridge;
    let dstBridge;
    let coinFactory;
    let coin;
    let bridgeLock;
    let dstCoinAddr;
    let initCoinAmount;
    before(async () => {
        const [owner] = await ethers.getSigners();
        TEST_BRIDGELOCK.receiver = owner.address;
        TEST_BRIDGELOCK.sender = owner.address;
        
        coinFactory = await ethers.getContractFactory("ValCoin");
        coin = await coinFactory.deploy("TST", "Test coin");
        await coin.deployed();
        TEST_BRIDGELOCK.srcCoin = coin.address;

        bridgeFactory = await ethers.getContractFactory("ERC20Bridge");
        srcBridge = await bridgeFactory.deploy(TEST_BRIDGELOCK.srcChainId);
        await srcBridge.deployed();

        dstBridge = await bridgeFactory.deploy(TEST_BRIDGELOCK.dstChainId);
        await dstBridge.deployed();

        //deploy coins before test
        await srcBridge.addCoin(coin.address);

        //bridge come coins to have for the bridge back
        await coin.approve(srcBridge.address, 100);
        await srcBridge.bridgeCoin(
            TEST_BRIDGELOCK.srcCoin,
            TEST_BRIDGELOCK.receiver,
            100,
            TEST_BRIDGELOCK.hashLock,
            TEST_BRIDGELOCK.dstChainId,
        );
        
        await dstBridge.deployCoin(
            TEST_BRIDGELOCK.srcChainId, 
            TEST_BRIDGELOCK.srcCoin, 
            await coin.symbol(),
            await coin.name(),
        )

        //add coin on source contract as well
        dstCoinAddr = await dstBridge.getDstCoin(coin.address);
        await srcBridge.addDestination(dstCoinAddr, TEST_BRIDGELOCK.srcCoin);

        //addrelease because bridged coins can be minted only from the contract
        await dstBridge.addRelease(
            TEST_BYTES32,
            TEST_BRIDGELOCK.srcChainId,
            coin.address,
            TEST_BRIDGELOCK.sender,
            TEST_BRIDGELOCK.receiver,
            TEST_BRIDGELOCK.amount+1,
            TEST_BRIDGELOCK.hashLock
        );

        //and then release them
        await dstBridge.releaseMintCoin(TEST_BYTES32, TEST_PREIMAGE)

        //get balance before bridgeBack
        initCoinAmount = await coin.balanceOf(TEST_BRIDGELOCK.receiver);
    });

    //user selects coin from list and the ui checks if the coin is original
    //it is a dest coin if dstToOrigChainId is set for the coin address
    it("dstContract.getDestToOriginChainId should return srcChainId", async () => {
        expect(await dstBridge.isCoinOriginal(dstCoinAddr)).to.equal(false);
    })

    //since it is not 0 use bridgeBurnCoin for the users bridge back
    it("bridgeBurnCoin should emit CoinBridged event", async () => {
        expect(dstBridge.bridgeBurnCoin(
            dstCoinAddr,
            TEST_BRIDGELOCK.receiver,
            TEST_BRIDGELOCK.amount,
            TEST_BRIDGELOCK.hashLock,
            TEST_BRIDGELOCK.srcChainId,
        )).to.emit(dstBridge, "CoinBridged");
        bridgeLock = (await dstBridge.getBridgeLocks())[1];
        TEST_BRIDGELOCK.id = bridgeLock.id;
    }) 

    //when the event is emitted the validator sees it and checks if the
    //coin bridged is original or a bridged one
    //in this case it is a bridged one - it was checked above

    //also the validator needs to know if the source bridge 
    //has a source for this destination
    //in this case it should have a source
    //keep in mind when deploying coin on destination contract
    //it is added as source on the source contracts source to destination bridge
    //this is done because the bridgelocks always hold only the coin which was locked/burned
    //on the bridged on the chain where the bridge/bridgeback started
    //and the contract has to know which coin to use as destination for the bridged coin
    it("dstBridge destinationExists should return true", async () => {
        expect(await srcBridge.destinationExists(bridgeLock.coin)).to.equal(true);
    })
    
    //now when everything is prepared validator adds release on src contract
    it("srcBridge addRelease should emit ReleaseAdded with correct id", async () => {
        expect(await srcBridge.addRelease(
            bridgeLock.id,
            bridgeLock.srcChainId,
            bridgeLock.coin,
            bridgeLock.sender,
            bridgeLock.receiver,
            bridgeLock.amount,
            bridgeLock.hashlock
        )).to.emit(srcBridge, "ReleaseAdded").withArgs(bridgeLock.id);
    })

    //when the validator receives the releaseAdded event
    //he checks if the coin is src for the source bridge
    //in this case it is - the check is the same as above
    
    //now the user can release the coins on the target chain
    //since the coin is a original => bridged the frontend will call releaseMintCoin
    it("srcBridge releaseTransferCoin should emit CoinReleased and transfer coin", async () => {
        expect(srcBridge.releaseTransferCoin(bridgeLock.id, TEST_PREIMAGE))
        .to.emit(srcBridge, "CoinReleased")
        .withArgs(bridgeLock.id, TEST_PREIMAGE);
        expect((await coin.balanceOf(bridgeLock.receiver)).toString()).to.equal(initCoinAmount.add(bridgeLock.amount).toString());
   })

})


describe("BridgeRefundTest", function () {
    let bridgeFactory;
    let srcBridge;
    let coinFactory;
    let coin;
    let bridgeLock;
    before(async () => {
        const [owner] = await ethers.getSigners();
        TEST_BRIDGELOCK.receiver = owner.address;
        TEST_BRIDGELOCK.sender = owner.address;
        
        coinFactory = await ethers.getContractFactory("ValCoin");
        coin = await coinFactory.deploy("TST", "Test coin");
        await coin.deployed();
        TEST_BRIDGELOCK.srcCoin = coin.address;

        bridgeFactory = await ethers.getContractFactory("ERC20Bridge");
        srcBridge = await bridgeFactory.deploy(TEST_BRIDGELOCK.srcChainId);
        await srcBridge.deployed();

        //deploy coins before test
        await srcBridge.addCoin(coin.address);

        //bridge come coins to have for the bridge back
        await coin.approve(srcBridge.address, 100);
        await srcBridge.bridgeCoin(
            TEST_BRIDGELOCK.srcCoin,
            TEST_BRIDGELOCK.receiver,
            TEST_BRIDGELOCK.amount,
            TEST_BRIDGELOCK.hashLock,
            TEST_BRIDGELOCK.dstChainId,
        );
        
        bridgeLock = (await srcBridge.getBridgeLocks())[0];

        //get balance before bridgeBack
        initCoinAmount = await coin.balanceOf(TEST_BRIDGELOCK.sender);
    });

    //bridgelock added now release it
    //since the coin is an original one, the ui will call refundTransfer
    it("srcCoin refundTransfer should emit event and lock bridge", async () => {
        expect(srcBridge.refundTransfer(bridgeLock.id, TEST_PREIMAGE))
            .to.emit(srcBridge, "CoinRefunded")
            .withArgs(bridgeLock.id, TEST_PREIMAGE);
        
        expect((await srcBridge.getBridgeLock(bridgeLock.id)).active).to.equal(false);
    });

    it("srcCoin refundTransfer should return coins to sender", async () => {
        expect((await coin.balanceOf(bridgeLock.sender)).toString()).to.equal(initCoinAmount.add(bridgeLock.amount).toString());
    })

})

describe("RefundMintTest", function () {
    let bridgeFactory;
    let srcBridge;
    let dstBridge;
    let coinFactory;
    let coin;
    let bridgeLock;
    let dstCoinAddr;
    let initCoinAmount;
    let deployedCoinContract;
    before(async () => {
        const [owner] = await ethers.getSigners();
        TEST_BRIDGELOCK.receiver = owner.address;
        TEST_BRIDGELOCK.sender = owner.address;
        
        coinFactory = await ethers.getContractFactory("ValCoin");
        coin = await coinFactory.deploy("TST", "Test coin");
        await coin.deployed();
        TEST_BRIDGELOCK.srcCoin = coin.address;

        bridgeFactory = await ethers.getContractFactory("ERC20Bridge");
        srcBridge = await bridgeFactory.deploy(TEST_BRIDGELOCK.srcChainId);
        await srcBridge.deployed();

        dstBridge = await bridgeFactory.deploy(TEST_BRIDGELOCK.dstChainId);
        await dstBridge.deployed();

        await dstBridge.deployCoin(
            TEST_BRIDGELOCK.srcChainId, 
            TEST_BRIDGELOCK.srcCoin, 
            await coin.symbol(),
            await coin.name(),
        )

        //add coin on source contract as well
        dstCoinAddr = await dstBridge.getDstCoin(coin.address);

        //addrelease because bridged coins can be minted only from the contract
        await dstBridge.addRelease(
            TEST_BYTES32,
            TEST_BRIDGELOCK.srcChainId,
            coin.address,
            TEST_BRIDGELOCK.sender,
            TEST_BRIDGELOCK.receiver,
            TEST_BRIDGELOCK.amount+1,
            TEST_BRIDGELOCK.hashLock
        );

        //and then release them
        await dstBridge.releaseMintCoin(TEST_BYTES32, TEST_PREIMAGE)

        //now create a bridgeLock to be refunded
        await dstBridge.bridgeBurnCoin(
            dstCoinAddr,
            TEST_BRIDGELOCK.receiver,
            TEST_BRIDGELOCK.amount,
            TEST_BRIDGELOCK.hashLock,
            TEST_BRIDGELOCK.srcChainId,
        )

        
        bridgeLock = (await dstBridge.getBridgeLocks())[1];
        //get balance before bridgeBack
        const accounts = await hre.ethers.getSigners();
        deployedCoinContract = ethers.ContractFactory.getContract(dstCoinAddr, MintableERC20.abi, accounts[0]);
        initCoinAmount = await deployedCoinContract.balanceOf(TEST_BRIDGELOCK.sender);
    });

    //bridgelock added now release it
    //since the coin is not an original one, the ui will call refundMint
    it("dstBridge refundMint should emit event and lock bridge", async () => {
        expect(dstBridge.refundMint(bridgeLock.id, TEST_PREIMAGE))
            .to.emit(dstBridge, "CoinRefunded")
            .withArgs(bridgeLock.id, TEST_PREIMAGE);
        
        expect((await dstBridge.getBridgeLock(bridgeLock.id)).active).to.equal(false);
    });

    it("dstBridge refundMint should return coins to sender", async () => {
        expect((await deployedCoinContract.balanceOf(bridgeLock.sender)).toString()).to.equal(initCoinAmount.add(bridgeLock.amount).toString());
    })


})

