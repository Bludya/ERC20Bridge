
const hre = require('hardhat')
const ethers = hre.ethers;

async function deployValCoin(wallet) {
  let ERC20;

  if (wallet == null) {
    ERC20 = await hre.ethers.getContractFactory("ValCoin");
  } else {
    ERC20 = await hre.ethers.getContractFactory("ValCoin", wallet);
  }

  const valCoin = await ERC20.deploy();
  await valCoin.deployed();
  console.log("ValCoin deployed to:", valCoin.address);

  return valCoin.address;
}

async function deployERC20BridgeContract(coinAddr, wallet) {
  let ERC20Bridge;

  if (wallet == null) {
    ERC20Bridge = await hre.ethers.getContractFactory("ERC20Bridge");
  } else {
    ERC20Bridge = await hre.ethers.getContractFactory("ERC20Bridge", wallet);
  }
  
  const bridge = await ERC20Bridge.deploy(coinAddr);
  await bridge.deployed();
  console.log("Bridge deployed to:", bridge.address);

  return bridge;
}

module.exports = {deployValCoin, deployERC20BridgeContract};