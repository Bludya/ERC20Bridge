// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

abstract contract MintableERC20Abstr is ERC20, Ownable {
    function mint(address _account, uint256 _amount) public onlyOwner returns (bool){
        super._mint(_account, _amount);
        return true;
    }

    function burn(address _account, uint256 _amount) public onlyOwner returns (bool){
        super._burn(_account, _amount);
        return true;
    }
}

contract MintableERC20 is MintableERC20Abstr {
   constructor(string memory _name, string memory _denom) ERC20(_name, _denom) {
    }
}
