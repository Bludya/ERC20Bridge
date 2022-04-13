// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { MintableERC20 } from "./MintableERC20.sol";
import { BridgeLocker } from "./BridgeLocker.sol";

contract ERC20Bridge is BridgeLocker {
    
    event CoinBridged(bytes32 bridgeId);
    event CoinRefunded(bytes32 bridgeId, bytes32 preimage);
    event ReleaseAdded(bytes32 bridgeId);
    event CoinReleased(bytes32 bridgeId, bytes32 preimage);

    modifier positiveAmount(uint256 _amount) {
        require(_amount > 0, "token amount must be > 0");
        _;
    }

    modifier destinationNotExists(address _srcCoin){
        require(!destinationExists(_srcCoin), "Contract already exists for this source");
        _;
    }
    
    modifier srcDiffersDest(uint8 _src, uint8 _dst) {
        require(_src != _dst, "Source chain id can't be the same as destination chain id");
        _;
    }


    uint8 chainId;

    address[] private coins;
    mapping (address => bool) private origCoins;
    mapping (address => uint8) private dstToOrigChainIds;
    mapping (address => address) private coinMap;

    constructor (uint8 _chainId) {
        chainId = _chainId;
    }

    function addCoin(address _coin) 
        external 
        onlyOwner 
    {
        coins.push(_coin);
        origCoins[_coin] = true;
    }

    function bridgeCoin(
        address _srcCoin, 
        address _receiver,
        uint256 _amount,
        bytes32 _hashlock,
        uint8 _dstChainId
    ) 
        external 
        srcDiffersDest(chainId, _dstChainId)
        positiveAmount(_amount)
    {
        bytes32 id = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp
            )
        );
        
        addBridgeLock(id, _srcCoin, msg.sender, _receiver, _amount, _hashlock, chainId, _dstChainId, true);

        if (!ERC20(_srcCoin).transferFrom(msg.sender, address(this), _amount))
            revert("transferFrom failed");

        emit CoinBridged(id);
    }

    function bridgeBurnCoin(
        address _srcCoin, 
        address _receiver,
        uint256 _amount,
        bytes32 _hashlock,
        uint8 _dstChainId
    ) 
        external
        srcDiffersDest(chainId, _dstChainId)
        positiveAmount(_amount)
    {
        bytes32 id = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp
            )
        );
        
        addBridgeLock(id, _srcCoin, msg.sender, _receiver, _amount, _hashlock, chainId, _dstChainId, true);

        if (!MintableERC20(_srcCoin).burn(msg.sender, _amount))
            revert("burn failed");

        emit CoinBridged(id);
    }

    function refundMint(bytes32 _id, bytes32 _preimage)
        external
        isBridgeSender(_id, msg.sender)
    {
        deactivateBridgeLock(_id, _preimage);

        if (!MintableERC20(getBridgeLockSrcCoin(_id)).mint(msg.sender, getBridgeLockAmount(_id)))
            revert("refund failed");

        emit CoinRefunded(_id, _preimage);
    }

    function refundTransfer(bytes32 _id, bytes32 _preimage)
        external
        isBridgeSender(_id, msg.sender)
    {
        deactivateBridgeLock(_id, _preimage);

        if (!ERC20(getBridgeLockSrcCoin(_id)).transfer(msg.sender, getBridgeLockAmount(_id)))
            revert("transferFrom sender to this failed");

        emit CoinRefunded(_id, _preimage);
    }

    function deployCoin(
        uint8 _srcChainId,
        address _srcCoin, 
        string memory _coinName, 
        string memory _coinDenom
    )
        external
        onlyOwner
        destinationNotExists(_srcCoin)
    {
        address destCoin = address(new MintableERC20(_coinName, _coinDenom));

        dstToOrigChainIds[destCoin] = _srcChainId;
        coinMap[_srcCoin] = destCoin;
        coins.push(destCoin);
    }

    function addDestination(
        address _dstCoin,
        address _srcCoin
    )
        external
        onlyOwner
        destinationNotExists(_srcCoin)
    {
        coinMap[_dstCoin] = _srcCoin;
    }

    function addRelease(
        bytes32 _id,
        uint8 _srcChainId,
        address _srcCoin,
        address _sender,
        address _receiver,
        uint256 _amount,
        bytes32 _hashlock
    )   
        external
        onlyOwner
        positiveAmount(_amount)
        srcDiffersDest(_srcChainId, chainId)
    {
        addBridgeLock(_id, _srcCoin, _sender, _receiver, _amount, _hashlock, _srcChainId, chainId, false);

        emit ReleaseAdded(_id);
    }

    function releaseTransferCoin(
        bytes32 _id, 
        bytes32 _preimage
    ) 
        external
        isBridgeReceiver(_id, msg.sender)
    {
        address dstCoin = getDstCoinByBridgelockId(_id);
        
        if(!ERC20(dstCoin).transfer(msg.sender, getBridgeLockAmount(_id))) {
            revert("transfer failed");
        }

        emit CoinReleased(_id, _preimage);
    }

    function releaseMintCoin(
        bytes32 _id, 
        bytes32 _preimage
    ) 
        external
        isBridgeReceiver(_id, msg.sender)
    {
        address dstCoin = getDstCoinByBridgelockId(_id);
        
        if(!MintableERC20(dstCoin).mint(msg.sender, getBridgeLockAmount(_id))){
            revert("mint failed");
        }
        
        emit CoinReleased(_id, _preimage);
    }

    function destinationExists(address _srcCoin) 
        public 
        view 
        returns (bool) 
    {
           return coinMap[_srcCoin] != address(0);
    }

    function getAvailableCoins() 
        external 
        view 
        returns (address[] memory) 
    {
        return coins;
    }

    function getDstCoinByBridgelockId(bytes32 _id) 
        public
        view
        returns(address)
    {
        return getDstCoin(getBridgeLockSrcCoin(_id));
    }

    function getDstCoin(address _coin)
        public
        view
        returns (address)
    {
        return coinMap[_coin];
    }

    function getDestToOriginChainId(address _coin) 
        external
        view
        returns (uint8)
    {
        return dstToOrigChainIds[_coin];
    }
}