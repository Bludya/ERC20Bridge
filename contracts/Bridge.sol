// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { MintableERC20 } from "./MintableERC20.sol";

contract ERC20Bridge is Ownable {
    event CoinContractAdded(address newContract);
    event CoinBridged(bytes32 bridgeLock);
    event CoinRefunded(bytes32 bridgeLock, bytes32 preimage);
    event CoinRefundLocked(bytes32 bridgeLock);
    event ReleaseAdded(bytes32 bridgeLock);
    event CoinReleased(bytes32 bridgeLock, bytes32 preimage);
    event AddedDestination(address dest, address src);
    event CoinReleaseLocked(bytes32 bridgeLock);

    struct BridgeLock {
        bytes32 id;
        bytes32 hashlock;
        bytes32 preimage;
        address erc20Contract;
        address sender;
        address receiver;
        uint256 amount;
        bool active;
        bool isThisSrc;
    }

    modifier bridgeExists(bytes32 _bridgeLockId) {
        require(haveBridgeLock(_bridgeLockId), "bridge does not exist");
        _;
    }

    modifier active(bytes32 _bridgeLockId) {
        require(bridges[_bridgeLockId].active, "refundable: already refunded");
        _;
    }

    modifier hashlockMatches(bytes32 hashlock, bytes32 _x) {
        require(hashlock == keccak256(abi.encodePacked(_x)), "hashlock hash does not match");
        _;
    }
    
    address[] private coinContracts;
    bytes32[] private bridgeIds;
    mapping (bytes32 => BridgeLock) private bridges;
    mapping (address => bool) private originalContracts;
    mapping (address => address) private contractMap;

    function addCoin(address _contract) 
        external 
        onlyOwner 
    {
        require(!isContractOriginal(_contract), "Coin already exists as original");
        coinContracts.push(_contract);
        originalContracts[_contract] = true;

        emit CoinContractAdded( _contract);
    }

    function bridgeCoin(
        address _srcErc20, 
        address _receiver,
        uint256 _amount,
        bytes32 _hashlock
    ) 
        external 
    {
        require(_amount > 0, "token amount must be > 0");

        bytes32 bridgeLockId = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp
            )
        );


        require(!haveBridgeLock(bridgeLockId), "Bridge with same parameters already exists");
        
        bridgeIds.push(bridgeLockId);

        bridges[bridgeLockId] = BridgeLock(
            bridgeLockId,
            _hashlock,
            0x0,
            _srcErc20,
            msg.sender,
            _receiver,
            _amount,
            true,
            true
        );

        if(!originalContracts[_srcErc20]) {
            if (!MintableERC20(_srcErc20).burn(msg.sender, _amount))
                revert("burn failed");
        } else {
            if (!ERC20(_srcErc20).transferFrom(msg.sender, address(this), _amount))
                revert("transferFrom sender to this failed");
        }

        emit CoinBridged(bridgeLockId);
    }

    function lockBridge(bytes32 _bridgeLockId, bytes32 _preimage)
        external
        onlyOwner
        bridgeExists(_bridgeLockId)
        active(_bridgeLockId)
        hashlockMatches(bridges[_bridgeLockId].hashlock, _preimage)
    {
        BridgeLock storage c = bridges[_bridgeLockId];
        c.active = false;
        c.preimage = _preimage;
        emit CoinRefundLocked(_bridgeLockId);
    }

    function refund(bytes32 _bridgeLockId, bytes32 _preimage)
        external
        bridgeExists(_bridgeLockId)
        active(_bridgeLockId)
        hashlockMatches(bridges[_bridgeLockId].hashlock, _preimage)
    {
        require(bridges[_bridgeLockId].sender == msg.sender, "refundable: not sender");

        BridgeLock storage c = bridges[_bridgeLockId];
        c.active = false;
        c.preimage = _preimage;

        if(!originalContracts[c.erc20Contract]) {
            if (!MintableERC20(c.erc20Contract).mint(msg.sender, c.amount))
                revert("refund failed");
        } else {
            if (!ERC20(c.erc20Contract).transfer(c.sender, c.amount))
                revert("transferFrom sender to this failed");
        }

        emit CoinRefunded(_bridgeLockId, _preimage);
    }

    function addMissingDestination(
        bool shouldDeploy,
        address _destErc20,
        address _sourceErc20, 
        string memory _coinName, 
        string memory _coinDenom
    )
        external
        onlyOwner
    {
        require(!destinationExists(_sourceErc20), "Contract already exists for this source");

        if(shouldDeploy){
            MintableERC20 destContract = new MintableERC20(_coinName, _coinDenom);
            _destErc20 = address(destContract);
            contractMap[_sourceErc20] = _destErc20;
            coinContracts.push(_destErc20);
        } else {  
            contractMap[_destErc20] = _sourceErc20;
        }

        emit AddedDestination(_destErc20, _sourceErc20);
    }

    function addRelease(
        bytes32 _bridgeLockId,
        address _sourceErc20,
        address _sender,
        address _receiver,
        uint256 _amount,
        bytes32 _hashlock
    )   
        onlyOwner
        external
    {
        require(!haveBridgeLock(_bridgeLockId), "Release already exists");

        require(destinationExists(_sourceErc20), "Destination contract does not exist. Deploy first");

        
        bridgeIds.push(_bridgeLockId);

        bridges[_bridgeLockId] = BridgeLock(
            _bridgeLockId,
            _hashlock,
            0x0,
            _sourceErc20,
            _sender,
            _receiver,
            _amount,
            true,
            false
        );

        emit ReleaseAdded(_bridgeLockId);
    }

    function releaseCoin(
        bytes32 _bridgeLockId, 
        bytes32 _preimage
    ) 
        external 
        bridgeExists(_bridgeLockId)
        hashlockMatches(bridges[_bridgeLockId].hashlock, _preimage)
        active(_bridgeLockId)
    {
        BridgeLock storage r = bridges[_bridgeLockId];

        require(r.receiver == msg.sender, "msg.sender not bridgelock receiver");

        r.active = false;
        r.preimage = _preimage;
        
        address destContract = getDestinationContract(r.erc20Contract);
        
        if(!isContractOriginal(destContract)){
            if(!MintableERC20(destContract).mint(msg.sender, r.amount)){
                revert("mint failed");
            }
        } else {
            if(!ERC20(destContract).transfer(msg.sender, r.amount)) {
                revert("transfer failed");
            }
        }
        emit CoinReleased(_bridgeLockId, _preimage);
    }

    function isContractOriginal(address _coinContract)
        public
        view
        returns (bool)
    {
        return originalContracts[_coinContract];
    }

    function destinationExists(address _srcCoin) 
        public 
        view 
        returns (bool) 
    {
           return getDestinationContract(_srcCoin) != address(0);
    }

    function getDestinationContract(address _srcContract)
        public
        view
        returns (address)
    {
        return contractMap[_srcContract];
    }

    function getAvailableCoins() 
        external 
        view 
        returns (address[] memory) 
    {
        return coinContracts;
    }

    function getBridgeLock(bytes32 _bridgeLockId) 
        public
        view
        returns ( BridgeLock memory c) 
    {
        c = bridges[_bridgeLockId];
    } 

    function haveBridgeLock(bytes32 _bridgeLockId)
        internal
        view
        returns (bool)
    {
        return getBridgeLock(_bridgeLockId).sender != address(0);
    }

    function getBridges()
        external
        view
        returns (BridgeLock[] memory)
    {
        BridgeLock[] memory bls = new BridgeLock[]( bridgeIds.length );
        for(uint i = 0; i < bridgeIds.length; i++){
            bls[i] = getBridgeLock(bridgeIds[i]);
        }

        return bls;
    }
}