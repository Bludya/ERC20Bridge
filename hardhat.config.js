require("@nomiclabs/hardhat-waffle");
require("solidity-coverage");
require("@nomiclabs/hardhat-etherscan");
const { resolve } = require("path");
const {config} = require("dotenv");

config({ path: resolve(__dirname, "./.env") });
const keys = process.env.PRIVATE_KEYS.replace('"', '').split(',');

task("deploy", "Deploys coins and bridge contract on a provided network")
  .setAction(async () => {
    const {deployValCoin, deployERC20BridgeContract} = require("./scripts/deploy");
    await hre.run('compile'); // We are compiling the contracts using subtask
    const coins = [];

    for(let i = 0; i < 3; i++){
      const name = 'Coin ' + i;
      const symbol = 'VAL' + i;
      const coin = {
        symbol,
        addr: await deployValCoin(name, symbol),
      }
      coins.push(coin);
    }
    const bridgeContract = await deployERC20BridgeContract(coins);
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.4",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    }
  },
  networks: {
    rinkeby: {
      url: 'https://rinkeby.infura.io/v3/' + process.env.INFURA_ID,
      accounts: keys,
      chainId: 4,
    },
    ropsten: {
      url: 'https://ropsten.infura.io/v3/' + process.env.INFURA_ID,
      accounts: keys,
      chainId: 3,
    }
  }
};
