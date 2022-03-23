require("@nomiclabs/hardhat-waffle");
require("solidity-coverage");
require("@nomiclabs/hardhat-etherscan");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("deploy-testnets", "Deploys contract on a provided network")
    .setAction(async () => {
        const deployElectionContract = require("./scripts/deploy");
        await deployElectionContract();
});

task("deploy-mainnet", "Deploys contract on a provided network")
  .addParam("privateKey", "Please provide the private key")
  .setAction(async ({privateKey}) => {
    const deployElectionContract = require("./scripts/deploy-with-param");
    await deployElectionContract(privateKey);
});

subtask("print", "Prints a message")
  .addParam("message", "The message to print")
  .setAction(async (taskArgs) => {
    console.log(taskArgs.message);
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

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
      url: "https://rinkeby.infura.io/v3/14c2981e947d46b79c76709a84cda8b2",
      accounts: ['711531b5e21921f66b7a6f7483d755f1c23abfb24b8faf9b6770a179a9a49562'],
    }
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: "CHIRAADNUI814XIT9ST36R63UFNBNDKBDY"
  }
};
