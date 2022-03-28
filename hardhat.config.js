require("@nomiclabs/hardhat-waffle");
require("solidity-coverage");
require("@nomiclabs/hardhat-etherscan");
let env = require("./secrets.json");

task("deploy-local", "Deploys VAL coin and bridge contract locally")
    .setAction(async () => {
    const {deployValCoin, deployERC20BridgeContract} = require("./scripts/deploy");
    await hre.run('compile'); // We are compiling the contracts using subtask
    
    const valCoinAddr = await deployValCoin();
    await deployERC20BridgeContract(valCoinAddr);
});

task("deploy", "Deploys VAL coin and bridge contract on a provided network")
  .setAction(async () => {
    const {deployValCoin, deployERC20BridgeContract} = require("./scripts/deploy");
    await hre.run('compile'); // We are compiling the contracts using subtask

    const valCoinAddr = await deployValCoin();
    const bridgeContract = await deployERC20BridgeContract(valCoinAddr);

    await bridgeContract.deployTransaction.wait(5);

    await hre.run("verify:verify", {
      address: bridgeContract.address,
      constructorArguments: [
        valCoinAddr
      ],
    });
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
      url: env.rinkebyUrl,
      accounts: env.privateKeys,
    }
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: env.etherscanApi,
  }
};
