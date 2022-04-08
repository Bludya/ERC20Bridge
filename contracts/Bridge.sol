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
    event CoinReleased(bytes32 bridgeLock, bytes32 preimage);
    event DestContractDeployed(address destContract, address sourceContract);
    event CoinReleaseLocked(bytes32 bridgeLock);

    struct BridgeLock {
        address erc20Contract;
        address sender;
        uint256 amount;
        bytes32 hashlock;
        bool withdrawn;
        bool refunded;
        bytes32 preimage;
    }

    struct Release {
        address erc20Contract;
        uint256 amount;
        bytes32 hashlock;
        bytes32 preimage;
        bool withdrawn;
    }

    modifier bridgeExists(bytes32 _bridgeLockId) {
        require(haveBridgeLock(_bridgeLockId), "bridgeLockId does not exist");
        _;
    }

    modifier releaseExists(bytes32 _bridgeLockId) {
        require(haveRelease(_bridgeLockId), "bridgeLockId does not exist as a release");
        _;
    }

    modifier refundable(bytes32 _bridgeLockId) {
        require(bridges[_bridgeLockId].sender == msg.sender, "refundable: not sender");
        require(bridges[_bridgeLockId].refunded == false, "refundable: already refunded");
        require(bridges[_bridgeLockId].withdrawn == false, "refundable: already withdrawn");
        _;
    }

    modifier releaseHashlockMatches(bytes32 _bridgeLockId, bytes32 _x) {
        require(
            releases[_bridgeLockId].hashlock == keccak256(abi.encodePacked(_x)),
            "hashlock hash does not match"
        );
        _;
    }
    
    modifier refundHashlockMatches(bytes32 _bridgeLockId, bytes32 _x) {
        require(
            bridges[_bridgeLockId].hashlock == keccak256(abi.encodePacked(_x)),
            "hashlock hash does not match"
        );
        _;
    }

    modifier releasable(bytes32 _bridgeLockId) {
        require(releases[_bridgeLockId].withdrawn == false, "releasable: already withdrawn");
        _;
    }
    
    address[] coinContracts;
    
    //TODO: used only to check if the contract not already in set, should I remove it?
    mapping (address => bool) coinContractsSupported;
    mapping (bytes32 => BridgeLock) private bridges;
    mapping (bytes32 => Release) private releases;
    mapping (address => address) private mintingContracts;
    mapping (address => address) private sourceContracts;

    function addCoin(address _contract) external onlyOwner {
        require(!coinContractsSupported[_contract], "Contract already set");

        coinContracts.push(_contract);

        emit CoinContractAdded( _contract);
    }

    function bridgeCoin(
        address _erc20Contract, 
        uint256 _amount,
        bytes32 _hashlock
    ) 
        external 
    {
        require(_amount > 0, "token amount must be > 0");
        require(_erc20Contract != address(0), "contract address can't be empty");

        bytes32 bridgeLockId = keccak256(
            abi.encodePacked(
                msg.sender,
                _erc20Contract,
                _amount,
                _hashlock
            )
        );

        if (haveBridgeLock(bridgeLockId))
            revert("Bridge with same parameters already exists");

        // if it is a bridged coin, burn the coins
        if(mintingContracts[_erc20Contract] != address(0)) {
            if (!MintableERC20(_erc20Contract).burn(msg.sender, _amount))
                revert("burn failed");
        // If it is original coin, this contract becomes the temporary owner of the tokens
        } else {
            if (!ERC20(_erc20Contract).transferFrom(msg.sender, address(this), _amount))
                revert("transferFrom sender to this failed");
        }

        bridges[bridgeLockId] = BridgeLock(
            _erc20Contract,
            msg.sender,
            _amount,
            _hashlock,
            false,
            false,
            0x0
        );

        emit CoinBridged(bridgeLockId);
    }

    function lockBridge(bytes32 _bridgeLockId, bytes32 _preimage)
        external
        onlyOwner
        bridgeExists(_bridgeLockId)
        refundable(_bridgeLockId)
        refundHashlockMatches(_bridgeLockId, _preimage)
    {
        BridgeLock storage c = bridges[_bridgeLockId];
        c.refunded = true;
        c.preimage = _preimage;
        emit CoinRefundLocked(_bridgeLockId);
    }


    function refund(bytes32 _bridgeLockId, bytes32 _preimage)
        external
        bridgeExists(_bridgeLockId)
        refundable(_bridgeLockId)
        refundHashlockMatches(_bridgeLockId, _preimage)
    {
        BridgeLock storage c = bridges[_bridgeLockId];
        c.refunded = true;
        c.preimage = _preimage;
        ERC20(c.erc20Contract).transfer(c.sender, c.amount);
        emit CoinRefunded(_bridgeLockId, _preimage);
    }

    function deployDestErc20(address _sourceErc20Contract, string memory _coinName, string memory _coinDenom)
        external
        onlyOwner
    {
        require(mintingContracts[_sourceErc20Contract] == address(0), "Contract already exists for this source");

        MintableERC20 destContract = new MintableERC20(_coinName, _coinDenom);

        address destAddress = address(destContract);

        mintingContracts[_sourceErc20Contract] = destAddress;
        coinContractsSupported[destAddress] = true;
        coinContracts.push(destAddress);

        emit DestContractDeployed(destAddress, _sourceErc20Contract);
    }

    function addRelease(
        bytes32 _bridgeLockId,
        address _sourceErc20Contract,
        uint256 _amount,
        bytes32 _hashlock
    )   
        onlyOwner
        external
    {
        require(!haveRelease(_bridgeLockId), "Release already exists");

        require(mintingContracts[_sourceErc20Contract] != address(0), "Destination contract not deployed. Deploy first");

        releases[_bridgeLockId] = Release(
            _sourceErc20Contract,
            _amount,
            _hashlock,
            0x0,
            false
        );
    }

    function lockRelease(bytes32 _bridgeLockId, bytes32 _preimage)
        external
        onlyOwner
        releaseExists(_bridgeLockId)
        releasable(_bridgeLockId)
        releaseHashlockMatches(_bridgeLockId, _preimage)
    {
        Release storage c = releases[_bridgeLockId];
        c.withdrawn = true;
        c.preimage = _preimage;
        emit CoinReleaseLocked(_bridgeLockId);
    }

    function releaseCoin(
        address _receiver,
        bytes32 _bridgeLockId, 
        bytes32 _preimage
    ) 
        external 
        releaseExists(_bridgeLockId)
        releaseHashlockMatches(_bridgeLockId, _preimage)
        releasable(_bridgeLockId)
    {
        Release storage r = releases[_bridgeLockId];
        r.preimage = _preimage;
        r.withdrawn = true;
        
        if(mintingContracts[r.erc20Contract] != address(0))
            MintableERC20(mintingContracts[r.erc20Contract]).mint(_receiver, r.amount);
        else
            ERC20(r.erc20Contract).transfer(_receiver, r.amount);

        emit CoinReleased(_bridgeLockId, _preimage);
    }


    function destinationExists(address srcCoin) 
        external 
        view 
        returns (bool) 
    {
        return mintingContracts[srcCoin] != address(0);
    }

    function getAvailableCoins() 
        external 
        view 
        returns (address[] memory) 
    {
        return coinContracts;
    }

    function getBridgeLock(bytes32 _bridgeLockId) 
        external
        view
        returns (
            address erc20Contract,
            address sender,
            uint256 amount,
            bytes32 hashlock,
            bool withdrawn,
            bool refunded,
            bytes32 preimage
        ) 
    {
        if (haveBridgeLock(_bridgeLockId) == false)
            return (address(0), address(0), 0, 0, false, false, 0);

        BridgeLock storage c = bridges[_bridgeLockId];
        return (
            c.erc20Contract,
            c.sender,
            c.amount,
            c.hashlock,
            c.withdrawn,
            c.refunded,
            c.preimage
        );
    } 

    function haveBridgeLock(bytes32 _bridgeLockId)
        internal
        view
        returns (bool exists)
    {
        exists = (bridges[_bridgeLockId].sender != address(0));
    }

    function haveRelease(bytes32 _bridgeLockId)
        internal
        view
        returns (bool exists)
    {
        exists = (releases[_bridgeLockId].erc20Contract != address(0));
    }

}