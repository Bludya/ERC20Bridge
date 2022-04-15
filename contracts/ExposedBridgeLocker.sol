// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { MintableERC20 } from "./MintableERC20.sol";
import { BridgeLocker } from "./BridgeLocker.sol";

//used for testing purposes
contract ExposedBridgeLocker is BridgeLocker {

  function _addBridgeLock(
        bytes32 _id,
        address _srcCoin, 
        address _sender,
        address _receiver,
        uint256 _amount,
        bytes32 _hashlock,
        uint8 _srcChainId,
        uint8 _dstChainId
    ) 
        external 
    {
        addBridgeLock(_id, _srcCoin, _sender, _receiver, _amount, _hashlock, _srcChainId, _dstChainId);
    }
}