
const hre = require('hardhat')
const ethers = hre.ethers;

async function deployValCoin(name, symbol, wallet) {
  let ERC20Contract;

  if (wallet == null) {
    ERC20Contract = await hre.ethers.getContractFactory("ValCoin");
  } else {
    ERC20Contract = await hre.ethers.getContractFactory("ValCoin", wallet);
  }

  const erc20Tx = await ERC20Contract.deploy(name, symbol);
  await erc20Tx.deployed();

  console.log("erc20 deployed to:", erc20Tx.address);

  return erc20Tx.address;
}

async function deployERC20BridgeContract(coins, wallet) {
  let ERC20Bridge;
  
  if (wallet == null) {
    ERC20Bridge = await hre.ethers.getContractFactory("ERC20Bridge");
  } else {
    ERC20Bridge = await hre.ethers.getContractFactory("ERC20Bridge", wallet);
  }

  const bridge = await ERC20Bridge.deploy(hre.network.config.chainId);
  await bridge.deployed();
  console.log("Bridge deployed to:", bridge.address);

  for (const coin of coins) {
    await bridge.addCoin(coin.addr);
    console.log(`Coin ${coin.symbol} added to bridge`);
  }
 
  return bridge;
}

module.exports = {deployValCoin, deployERC20BridgeContract};