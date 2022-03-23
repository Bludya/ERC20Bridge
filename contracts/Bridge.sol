// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USElection is Ownable {
    uint32 private coinIndex;
    string[] private coins;
    mapping(string => uint32) private coinIndeces;
    mapping(string => address) private coinContracts;

    event CoinContractReplaced(string indexed coinName, address oldContract, address newContract);
    event CoinContractAdded(string indexed coinName, address newContract);
    event CoinRemoved(string indexed coinName);
    event CoinBridged(address indexed sender, string indexed coinName, uint256 amount);
    event CoinReleased(address indexed receiver, string indexed coinName, uint256 amount);

    modifier notEmptyString(string memory _strVar) {
        bytes memory coinNameTest = bytes(_strVar);
        require(coinNameTest.length > 0, "Coin name can't be empty");
        _;
    }

    modifier notEmptyAddress(address _address) {
        require(_address != address(0), "Address can't be empty");
        _;
    }

    modifier notZeroAmount(uint256 _amount) {
         require(_amount > 0, "Amount must be higher than 0");
         _;
    }
   
    function getAvailableCoins() public view returns (string[] memory) {
        return coins;
    }

    function getCoinContract(string calldata _coinName) public view notEmptyString(_coinName) returns (address) {
        require(coinContracts[_coinName] == address(0), "Coin contract not supported");

        return coinContracts[_coinName];
    }

    function addCoin(string calldata _coinName, address _contract) public onlyOwner notEmptyString(_coinName) notEmptyAddress(_contract) {
        address oldCoinContract = coinContracts[_coinName];

        //If contract exists, just replace address
        if(oldCoinContract != address(0)) {
            coinContracts[_coinName] = _contract;

            emit CoinContractReplaced(_coinName, oldCoinContract, _contract);
        } else {
            coinIndex++;
            coinIndeces[_coinName] = coinIndex;
            coins[coinIndex] = _coinName;
            coinContracts[_coinName] = _contract;

            emit CoinContractAdded(_coinName, _contract);
        }
    }

    function removeCoin(string calldata _coinName) public onlyOwner notEmptyString(_coinName) {
        require(coinContracts[_coinName] == address(0), "Coin not supported, nothing to remove");

        uint32 removeCoinIndex = coinIndeces[_coinName];
        delete coins[removeCoinIndex];
        delete coinIndeces[_coinName];
        delete coinContracts[_coinName];

        emit CoinRemoved(_coinName);
    }

    function bridgeCoin(string calldata _coinName, uint256 _amount, address _receiver) public notEmptyString(_coinName) notEmptyAddress(_receiver) notZeroAmount(_amount) {
        address coinContractAddr = coinContracts[_coinName];
        ERC20 erc20Contract = ERC20(coinContractAddr);

        uint256 balance = erc20Contract.balanceOf(address(this));
        require(balance >= _amount, "Not enough balance");

        uint256 allowance = erc20Contract.allowance(msg.sender, address(this));
        require(allowance >= _amount, "Check the token allowance");
        
        erc20Contract.transferFrom(msg.sender, address(this), _amount);
        

        emit CoinBridged(msg.sender, _coinName, _amount);
    }

    function releaseCoin(string calldata _coinName, uint _amount) public notEmptyString(_coinName) notZeroAmount(_amount) {
        address coinContractAddr = coinContracts[_coinName];
        ERC20 erc20Contract = ERC20(coinContractAddr);
 
        uint256 balance = erc20Contract.balanceOf(msg.sender);
        require(balance >= _amount, "Not enough balance");

        erc20Contract.transfer(msg.sender, _amount);

        emit CoinReleased(msg.sender, _coinName, _amount)
    }
}