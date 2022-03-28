// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Bridge is Ownable {
    address[] coinContracts;
    mapping(address => bool) private coinContractsSupported;

    event CoinContractAdded(address newContract);
    event CoinRemoved(address oldContract);
    event CoinBridged(address indexed sender, address indexed coinContract, uint256 amount);
    event CoinReleased(address indexed receiver, address indexed coinContract, uint256 amount);

    constructor(address _coinContract) {
        addCoin(_coinContract);
    }

    modifier notEmptyAddress(address _address) {
        require(_address != address(0), "Address can't be empty");
        _;
    }

    modifier notZeroAmount(uint256 _amount) {
         require(_amount > 0, "Amount must be higher than 0");
         _;
    }
   
    function getAvailableCoins() public view returns (address[] memory) {
        return coinContracts;
    }

    function addCoin(address _contract) public onlyOwner notEmptyAddress(_contract) {
        require(!coinContractsSupported[_contract], "Contract already set");

        coinContractsSupported[_contract] = true;
        coinContracts.push(_contract);

        emit CoinContractAdded( _contract);
    }

    function removeCoin(address _contract) public onlyOwner{
        require(coinContractsSupported[_contract], "Contract not in the set");
        
        delete coinContractsSupported[_contract];

        emit CoinRemoved(_contract);
    }

    function bridgeCoin(address _contract, uint256 _amount, address _receiver) public notEmptyAddress(_receiver) notZeroAmount(_amount) {
        ERC20 erc20Contract = ERC20(_contract);

        erc20Contract.transferFrom(msg.sender, address(this), _amount);

        emit CoinBridged(msg.sender, _contract, _amount);
    }

    function releaseCoin(address _contract, uint _amount) public notZeroAmount(_amount) {
        ERC20 erc20Contract = ERC20(_contract);
 
        uint256 balance = erc20Contract.balanceOf(msg.sender);
        require(balance >= _amount, "Not enough balance");

        erc20Contract.transfer(msg.sender, _amount);

        emit CoinReleased(msg.sender, _contract, _amount);
    }
}