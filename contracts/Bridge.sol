// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { MintableERC20 } from "./MintableERC20.sol";
import { BridgeUtils } from "./BridgeUtils.sol";

contract ERC20Bridge is Ownable {
    
    event CoinBridged(bytes32 bridgeId);
    event CoinRefunded(bytes32 bridgeId, bytes32 preimage);
    event CoinRefundLocked(bytes32 bridgeId);
    event ReleaseAdded(bytes32 bridgeId);
    event CoinReleased(bytes32 bridgeId, bytes32 preimage);
    event CoinReleaseLocked(bytes32 bridgeId);
    
    modifier bridgeExists(bytes32 _Id) {
        require(bridges[_Id].sender != address(0), "bridge does not exist");
        _;
    }

    modifier active(bytes32 _Id) {
        require(bridges[_Id].active, "refundable: already refunded");
        _;
    }

    modifier hashlockMatches(bytes32 hashlock, bytes32 _x) {
        require(hashlock == keccak256(abi.encodePacked(_x)), "hashlock hash does not match");
        _;
    }
    
    uint8 chainId;

    address[] private coins;
    bytes32[] private bridgeIds;
    mapping (bytes32 => BridgeUtils.Bridge) private bridges;
    mapping (address => bool) private origCoins;
    mapping (address => uint8) private dstToOrigChainIds;
    mapping (address => address) private coinMap;

    constructor (uint8 _chainId) Ownable(){
        chainId = _chainId;
    }

    function addCoin(address _coin) 
        external 
        onlyOwner 
    {
        require(!isCoinOriginal(_coin), "Coin already exists as original");
        coins.push(_coin);
        origCoins[_coin] = true;
    }

    function bridgeCoin(
        address _srcCoin, 
        address _receiver,
        uint256 _amount,
        bytes32 _hashlock,
        uint8 _dstChainId
    ) 
        external 
    {
        require(_amount > 0, "token amount must be > 0");

        bytes32 Id = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp
            )
        );

        require(bridges[Id].sender == address(0), "Bridge exists");

        bool isOriginalCoin = origCoins[_srcCoin];
        require(isOriginalCoin || dstToOrigChainIds[_srcCoin] == _dstChainId, "dstChainId != srcChainId");
        
        bridgeIds.push(Id);

        bridges[Id] = BridgeUtils.Bridge(
            Id,
            _hashlock,
            0x0,
            chainId,
            _dstChainId,
            _srcCoin,
            msg.sender,
            _receiver,
            _amount,
            true,
            true
        );

        if(!isOriginalCoin) {
            if (!MintableERC20(_srcCoin).burn(msg.sender, _amount))
                revert("burn failed");
        } else {
            if (!ERC20(_srcCoin).transferFrom(msg.sender, address(this), _amount))
                revert("transferFrom failed");
        }

        emit CoinBridged(Id);
    }

    function lockBridge(bytes32 _Id, bytes32 _preimage)
        external
        onlyOwner
        bridgeExists(_Id)
        active(_Id)
        hashlockMatches(bridges[_Id].hashlock, _preimage)
    {
        BridgeUtils.Bridge storage c = bridges[_Id];
        c.active = false;
        c.preimage = _preimage;
        emit CoinRefundLocked(_Id);
    }

    function refund(bytes32 _Id, bytes32 _preimage)
        external
        bridgeExists(_Id)
        active(_Id)
        hashlockMatches(bridges[_Id].hashlock, _preimage)
    {
        require(bridges[_Id].sender == msg.sender, "refundable: not sender");

        BridgeUtils.Bridge storage c = bridges[_Id];
        c.active = false;
        c.preimage = _preimage;

        if(!origCoins[c.coin]) {
            if (!MintableERC20(c.coin).mint(msg.sender, c.amount))
                revert("refund failed");
        } else {
            if (!ERC20(c.coin).transfer(c.sender, c.amount))
                revert("transferFrom sender to this failed");
        }

        emit CoinRefunded(_Id, _preimage);
    }

    function addMissingDestination(
        bool _shouldDeploy,
        uint8 _srcChainId,
        address _dstCoin,
        address _srcCoin, 
        string memory _coinName, 
        string memory _coinDenom
    )
        external
        onlyOwner
    {
        require(!destinationExists(_srcCoin), "Contract already exists for this source");

        if(_shouldDeploy){
            MintableERC20 destCoin = new MintableERC20(_coinName, _coinDenom);
            _dstCoin = address(destCoin);

            dstToOrigChainIds[_dstCoin] = _srcChainId;
            coinMap[_srcCoin] = _dstCoin;
            coins.push(_dstCoin);
        } else {  
            coinMap[_dstCoin] = _srcCoin;
        }
    }

    function addRelease(
        bytes32 _Id,
        uint8 _srcChainId,
        address _srcCoin,
        address _sender,
        address _receiver,
        uint256 _amount,
        bytes32 _hashlock
    )   
        onlyOwner
        external
    {
        require(bridges[_Id].sender == address(0), "Release exists");

        require(destinationExists(_srcCoin), "Destination does not exist");

        
        bridgeIds.push(_Id);

        bridges[_Id] = BridgeUtils.Bridge(
            _Id,
            _hashlock,
            0x0,
            _srcChainId,
            chainId,
            _srcCoin,
            _sender,
            _receiver,
            _amount,
            true,
            false
        );

        emit ReleaseAdded(_Id);
    }

    function releaseCoin(
        bytes32 _Id, 
        bytes32 _preimage
    ) 
        external 
        bridgeExists(_Id)
        hashlockMatches(bridges[_Id].hashlock, _preimage)
        active(_Id)
    {
        BridgeUtils.Bridge storage r = bridges[_Id];

        require(r.receiver == msg.sender, "msg.sender != receiver");

        r.active = false;
        r.preimage = _preimage;
        
        address destCoin = coinMap[r.coin];
        
        if(!isCoinOriginal(destCoin)){
            if(!MintableERC20(destCoin).mint(msg.sender, r.amount)){
                revert("mint failed");
            }
        } else {
            if(!ERC20(destCoin).transfer(msg.sender, r.amount)) {
                revert("transfer failed");
            }
        }
        emit CoinReleased(_Id, _preimage);
    }

    function isCoinOriginal(address _coinContract)
        public
        view
        returns (bool)
    {
        return origCoins[_coinContract];
    }

    function destinationExists(address _srcCoin) 
        public 
        view 
        returns (bool) 
    {
           return coinMap[_srcCoin] != address(0);
    }

    function getAvailableCoins() 
        external 
        view 
        returns (address[] memory) 
    {
        return coins;
    }

    function getDstCoin(address _coin)
        external
        view
        returns (address)
    {
        return coinMap[_coin];
    }

    function getDestToOriginChainId(address _coin) 
        external
        view
        returns (uint8)
    {
        return dstToOrigChainIds[_coin];
    }

    function getBridges()
        external
        view
        returns (BridgeUtils.Bridge[] memory)
    {
        BridgeUtils.Bridge[] memory bls = new BridgeUtils.Bridge[]( bridgeIds.length );
        for(uint i = 0; i < bridgeIds.length; i++){
            bls[i] = bridges[bridgeIds[i]];
        }

        return bls;
    }
}