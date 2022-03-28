// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ValCoin is ERC20 {
    uint constant _initial_supply = 20000000000 * (10**18);
    constructor() ERC20("ValCoin", "VAL") {
        _mint(msg.sender, _initial_supply);
    }
}