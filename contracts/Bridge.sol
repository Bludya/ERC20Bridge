// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Bridge is Ownable {
    event CoinContractAdded(address newContract);
    event CoinBridged(bytes32 bridgeTimelock);
    event CoinRefunded(bytes32 bridgeTimelock);
    event CoinReleased(bytes32 bridgeTimelock);

    struct BridgeTimelock {
        address erc20Contract;
        address sender;
        uint256 amount;
        uint256 timelock;
        bytes32 hashlock;
        bool withdrawn;
        bool refunded;
        bytes32 preimage;
    }

    struct Release {
        address erc20Contract;
        uint256 amount;
        uint256 timelock;
        bytes32 hashlock;
        bytes32 preimage;
        bool withdrawn;
    }

    modifier tokensTransferable(address _token, address _sender, uint256 _amount) {
        require(_amount > 0, "token amount must be > 0");
        require(
            ERC20(_token).allowance(_sender, address(this)) >= _amount,
            "token allowance must be >= amount"
        );
        _;
    }

    modifier futureTimelock(uint256 _time) {
        require(_time > block.timestamp, "timelock time must be in the future");
        _;
    }

    modifier bridgeExists(bytes32 _bridgeTimelockId) {
        require(haveBridgeTimelock(_bridgeTimelockId), "bridgeTimelockId does not exist");
        _;
    }

    modifier releaseExists(bytes32 _bridgeTimelockId) {
        require(haveRelease(_bridgeTimelockId), "bridgeTimelockId does not exist as a release");
        _;
    }

    modifier refundable(bytes32 _bridgeTimelockId) {
        require(bridges[_bridgeTimelockId].sender == msg.sender, "refundable: not sender");
        require(bridges[_bridgeTimelockId].refunded == false, "refundable: already refunded");
        require(bridges[_bridgeTimelockId].withdrawn == false, "refundable: already withdrawn");
        require(bridges[_bridgeTimelockId].timelock <= block.timestamp, "refundable: timelock not yet passed");
        _;
    }

    modifier hashlockMatches(bytes32 _bridgeTimelockId, bytes32 _x) {
        require(
            releases[_bridgeTimelockId].hashlock == sha256(abi.encodePacked(_x)),
            "hashlock hash does not match"
        );
        _;
    }

    modifier releasable(bytes32 _bridgeTimelockId) {
        require(releases[_bridgeTimelockId].withdrawn == false, "releasable: already withdrawn");
        require(releases[_bridgeTimelockId].timelock > block.timestamp, "releasable: timelock time must be in the future");
        _;
    }
    
    address[] coinContracts;
    mapping(address => bool) private coinContractsSupported;

    mapping (bytes32 => BridgeTimelock) private bridges;
    mapping (bytes32 => Release) private releases;

    function addCoin(address _contract) external onlyOwner {
        require(!coinContractsSupported[_contract], "Contract already set");

        coinContracts.push(_contract);

        emit CoinContractAdded( _contract);
    }

    function bridgeCoin(
        address _erc20Contract, 
        uint256 _amount,
        bytes32 _hashlock,
        uint256 _timelock
    ) 
        external 
        tokensTransferable(_erc20Contract, msg.sender, _amount)
        futureTimelock(_timelock)
        returns (bytes32 bridgeTimelockId)
    {
        bridgeTimelockId = sha256(
            abi.encodePacked(
                msg.sender,
                _erc20Contract,
                _amount,
                _hashlock,
                _timelock
            )
        );

        if (haveBridgeTimelock(bridgeTimelockId))
            revert("Contract already exists");

        // This contract becomes the temporary owner of the tokens
        if (!ERC20(_erc20Contract).transferFrom(msg.sender, address(this), _amount))
            revert("transferFrom sender to this failed");

        bridges[bridgeTimelockId] = BridgeTimelock(
            _erc20Contract,
            msg.sender,
            _amount,
            _timelock,
            _hashlock,
            false,
            false,
            0x0
        );

        emit CoinBridged(bridgeTimelockId);
    }

    function refund(bytes32 _bridgeTimelockId)
        external
        bridgeExists(_bridgeTimelockId)
        refundable(_bridgeTimelockId)
        returns (bool)
    {
        BridgeTimelock storage c = bridges[_bridgeTimelockId];
        c.refunded = true;
        ERC20(c.erc20Contract).transfer(c.sender, c.amount);
        emit CoinRefunded(_bridgeTimelockId);

        return true;
    }

    function addRelease(
        bytes32 _bridgeTimelockId,
        address _erc20Contract,
        uint256 _amount,
        uint256 _timelock,
        bytes32 _hashlock
    )   
        external
        futureTimelock(_timelock)
        returns (bool)
    {
        if (haveRelease(_bridgeTimelockId))
            revert("Release already exists");

        releases[_bridgeTimelockId] = Release(
            _erc20Contract,
            _amount,
            _timelock,
            _hashlock,
            0x0,
            false
        );

        return true;
    }

    function releaseCoin(
        address _receiver,
        bytes32 _bridgeTimelockId, 
        bytes32 _preimage
    ) 
        external 
        releaseExists(_bridgeTimelockId)
        hashlockMatches(_bridgeTimelockId, _preimage)
        releasable(_bridgeTimelockId)
        returns (bool)
    {
        Release storage r = releases[_bridgeTimelockId];
        r.preimage = _preimage;
        r.withdrawn = true;
        ERC20(r.erc20Contract).transfer(_receiver, r.amount);

        emit CoinReleased(_bridgeTimelockId);

        return r.withdrawn;
    }

    function getAvailableCoins() external view returns (address[] memory) {
        return coinContracts;
    }

    function getBridgeTimelock(bytes32 _bridgeTimelockId) 
        external
        view
        returns (
            address erc20Contract,
            address sender,
            uint256 amount,
            uint256 timelock,
            bytes32 hashlock,
            bool withdrawn,
            bool refunded,
            bytes32 preimage
        ) 
    {
        if (haveBridgeTimelock(_bridgeTimelockId) == false)
            return (address(0), address(0), 0, 0, 0, false, false, 0);

        BridgeTimelock storage c = bridges[_bridgeTimelockId];
        return (
            c.erc20Contract,
            c.sender,
            c.amount,
            c.timelock,
            c.hashlock,
            c.withdrawn,
            c.refunded,
            c.preimage
        );
    } 

    function haveBridgeTimelock(bytes32 _bridgeTimelockId)
        internal
        view
        returns (bool exists)
    {
        exists = (bridges[_bridgeTimelockId].sender != address(0));
    }

    function haveRelease(bytes32 _bridgeTimelockId)
        internal
        view
        returns (bool exists)
    {
        exists = (releases[_bridgeTimelockId].erc20Contract != address(0));
    }

}