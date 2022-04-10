# ERC20Bridge
## To run:
1. Deploy bridge with 3 coins on rinkeby: `npm hardhat deploy --network rinkeby`
2. Deploy bridge with 3 coins on ropsten: `npm hardhat deploy --network ropsten`
3. Fill an .env file in /ui with the addresses of the bridges and some wallets to sign tx as a validator
4. from /ui folder run `npm run start`