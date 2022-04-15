// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { MintableERC20 } from "./MintableERC20.sol";

contract BridgeLocker is Ownable {
    event BridgeLocked(bytes32 bridgeId);

    modifier bridgeExists(bytes32 _id) {
        require(getBridgeLock(_id).sender != address(0), "bridge does not exist");
        _;
    }

    modifier bridgeNotExists(bytes32 _id) {
        require(getBridgeLock(_id).sender == address(0), "bridge already exists exist");
        _;
    }

    modifier active(bytes32 _id) {
        require(getBridgeLock(_id).active, "BridgeLock already inactive");
        _;
    }

    modifier hashlockMatches(bytes32 _hashlock, bytes32 _x) {
        require(_hashlock == keccak256(abi.encodePacked(_x)), "hashlock hash does not match");
        _;
    }

    modifier isBridgeReceiver(bytes32 _id, address _address) {
        require(getBridgeLock(_id).receiver == _address, "msg.sender != bridge.receiver");
        _;
    }

     modifier isBridgeSender(bytes32 _id, address _address) {
        require(getBridgeLock(_id).sender == _address, "msg.sender != bridge.sender");
        _;
    }
    

    //holds all the needed data for a bridge
    struct BridgeLock {
        bytes32 id;
        bytes32 hashlock; //hashlock derived from the preimage, used for security
        bytes32 preimage; //preimage used as a 'password' to unlock bridgeLocks
        uint8 srcChainId; //chainId for the chain on which the lock originates
        uint8 dstChainId; //chainId for the destination chain
        address coin; //ERC20 contract address for the SOURCE coin
        address sender; //sender address, used so that only the sender can refund on source chain
        address receiver; //receiver address, used so that only he can release on target chain
        uint256 amount; //amount of the coins bridged
        bool active; //if true, the coin can still be released/refunded
    }


    bytes32[] private bridgeLockIds; 
    mapping (bytes32 => BridgeLock) private bridgeLocks;

    //creates a new bridgelock and adds it to the mapping
    //used when a new bridging is started or when bridge should be added to the destination contract 
    function addBridgeLock(
        bytes32 _id,
        address _srcCoin, 
        address _sender,
        address _receiver,
        uint256 _amount,
        bytes32 _hashlock,
        uint8 _srcChainId,
        uint8 _dstChainId
    ) 
        internal 
        bridgeNotExists(_id)
    {
        bridgeLockIds.push(_id);

        bridgeLocks[_id] = BridgeLock(
            _id,
            _hashlock,
            0x0,
            _srcChainId,
            _dstChainId,
            _srcCoin,
            _sender,
            _receiver,
            _amount,
            true
        );
    }

    function deactivateBridgeLock(bytes32 _id, bytes32 _preimage)
        internal
        bridgeExists(_id)
        active(_id)
        hashlockMatches(getBridgeLock(_id).hashlock, _preimage)
    {
        BridgeLock storage c = bridgeLocks[_id];
        c.active = false;
        c.preimage = _preimage;
    }

    //deactivates the bridge - to be used only by the validator when the bridge on the other side is released/refunded
    function lockBridge(bytes32 _id, bytes32 _preimage)
        external
        onlyOwner
    {
        deactivateBridgeLock(_id, _preimage);
        emit BridgeLocked(_id);
    }

    function getBridgeLockSrcCoin(bytes32 _id)
        public
        view
        returns (address) 
    {
        return getBridgeLock(_id).coin;
    }

    function getBridgeLockAmount(bytes32 _id)
        internal
        view
        returns (uint256) 
    {
        return getBridgeLock(_id).amount;
    }

    function getBridgeLock(bytes32 _id)
        public
        view
        returns (BridgeLock memory) 
    {
        return bridgeLocks[_id];   
    }
    
    function getBridgeLocks()
        external
        view
        returns (BridgeLock[] memory bls)
    {
        bls = new BridgeLock[]( bridgeLockIds.length );
        for(uint i = 0; i < bridgeLockIds.length; i++){
            bls[i] = bridgeLocks[bridgeLockIds[i]];
        }
    }
}