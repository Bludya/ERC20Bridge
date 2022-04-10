// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma abicoder v2;

abstract contract BridgeUtils {

    struct Bridge {
        bytes32 id;
        bytes32 hashlock;
        bytes32 preimage;
        uint8 srcChainId;
        uint8 dstChainId;
        address coin;
        address sender;
        address receiver;
        uint256 amount;
        bool active;
        bool isThisSrc;
    }

}