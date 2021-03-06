import * as React from 'react';
import styled from 'styled-components';
import { getContract } from './helpers/ethers';
import Bridge from './constants/abis/ERC20Bridge.json'
import Web3Modal from 'web3modal';
import web3 from 'web3';
// @ts-ignore
import WalletConnectProvider from '@walletconnect/web3-provider';
import Column from './components/Column';
import Wrapper from './components/Wrapper';
import Header from './components/Header';
import Loader from './components/Loader';
import ConnectButton from './components/ConnectButton';

import { Web3Provider } from '@ethersproject/providers';
import { getChainData } from './helpers/utilities';
import ERC20 from "erc-20-abi";
import { ethers } from 'ethers';
import BridgeForm, { ICoin } from './components/BridgeForm';
import constants from './constants/constants';
import RefundForm from './components/RefundForm';
import ReleaseForm from './components/ReleaseForm';
import { Alert, AlertTitle } from '@material-ui/lab';
import BigNumber from 'bignumber.js';
import { FormControl, InputLabel, Select, MenuItem, List, ListItem } from '@material-ui/core';

const Message = styled.h2`
  color: blue;
`

const SLayout = styled.div`
  position: relative;
  width: 100%;
  min-height: 100vh;
  text-align: center;
`;

const SContent = styled(Wrapper)`
  width: 100%;
  height: 100%;
  padding: 0 16px;
  display: flex;
  flex-direction: row;
`;

const SContainer = styled.div`
  height: 100%;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  word-break: break-word;
`;

const SLanding = styled(Column)`
  height: 600px;
`;

const SColumn = styled(Column)`
  width: 20%;
`;

// @ts-ignore
const SBalances = styled(SLanding)`
  height: 100%;
  & h3 {
    padding-top: 30px;
  }
`;

interface IAppState {
  fetching: boolean;
  message: string;
  address: string;
  library: any;
  srcBridge: ethers.Contract;
  connected: boolean;
  chainId: number;
  pendingRequest: boolean;
  networkSelected: string;
  destinationNetwork: string;
  coinSelected: string;
  isSelectedCoinOriginal: boolean;
  coinBalance: BigNumber;
  coinAmount: string;
  coins: ICoin[];
  bridgeSecret: string;
  refundSecret: string;
  releaseSecret: string;
  bridgeLocks: object[];
  selectedBridgeLockId: string;
  releaseLocks: object[];
  selectedReleaseLockId: string;
  releaseAddress: string;
  showError: boolean;
  errorMessage: string;
  showSuccess: boolean;
  txHash: string;
}

const INITIAL_STATE: IAppState = {
  fetching: false,
  message: '',
  address: '',
  library: null,
  srcBridge: null,
  connected: false,
  chainId: 4,
  pendingRequest: false,
  networkSelected: '4',
  destinationNetwork: '',
  coinSelected: '',
  isSelectedCoinOriginal: true,
  coinBalance: new BigNumber(0),
  coinAmount: '',
  coins: [],
  bridgeSecret: '',
  refundSecret: '',
  releaseSecret: '',
  bridgeLocks: [],
  selectedBridgeLockId: '',
  releaseLocks: [],
  selectedReleaseLockId: '',
  releaseAddress: '',
  showError: false,
  errorMessage: '',
  showSuccess: false,
  txHash: '',
};

class App extends React.Component<any, any> {
  // @ts-ignore
  public web3Modal: Web3Modal;
  public state: IAppState;
  public provider: any;
  public bridges: ethers.Contract[] = [];

  constructor(props: any) {
    super(props);
    this.state = {
      ...INITIAL_STATE
    };

    this.web3Modal = new Web3Modal({
      network: this.getNetwork(),
      cacheProvider: true,
      providerOptions: this.getProviderOptions()
    });
    
    const rinkebyProvider = new ethers.providers.InfuraProvider('rinkeby', process.env.REACT_APP_INFURA_ID);
    const rinkebyWallet = new ethers.Wallet(process.env.REACT_APP_VALIDATOR_PRIV_KEY_RINKEBY || '', rinkebyProvider);
    const rinkebyBridge = ethers.ContractFactory.getContract(process.env.REACT_APP_BRIDGE_ADDRESS_RINKEBY || '', Bridge.abi, rinkebyWallet);

    const ropstenProvider = new ethers.providers.InfuraProvider('ropsten', process.env.REACT_APP_INFURA_ID);
    const ropstenWallet = new ethers.Wallet(process.env.REACT_APP_VALIDATOR_PRIV_KEY_ROPSTEN || '', ropstenProvider);
    const ropstenBridge = ethers.ContractFactory.getContract(process.env.REACT_APP_BRIDGE_ADDRESS_ROPSTEN || '', Bridge.abi, ropstenWallet);

    this.addListeners(rinkebyBridge);
    this.addListeners(ropstenBridge);

    this.bridges[3] = ropstenBridge;
    this.bridges[4] = rinkebyBridge;
  }

  public componentDidMount() {
    if (this.web3Modal.cachedProvider) {
      this.onConnect();
    }
  }

  public addListeners(bridge: ethers.Contract) {
    bridge.on('CoinBridged', async (bridgeId: any) => {
      this.setState({message: 'Coin bridged, adding a release...'})
      try {
        const bridgeLock = await bridge.getBridgeLock(bridgeId);
        const srcErc20Contract = bridgeLock.coin;
        const wallet = bridge.signer;
        const srcErc20 = ethers.ContractFactory.getContract(srcErc20Contract, ERC20, wallet);
        const symbol = await srcErc20.symbol();
        const name = await srcErc20.name();
        const contractOriginal = await bridge.isCoinOriginal(srcErc20Contract);

        const destBridge = this.bridges[bridgeLock.dstChainId];

        const destExists = await destBridge.destinationExists(srcErc20Contract);

        if(contractOriginal && !destExists){
          this.setState({message: 'Coin does not yet exist on target chain, deploying ERC20...'})

          const deployTx = await destBridge.deployCoin(bridgeLock.srcChainId, srcErc20Contract,'Bridged ' + name, 'b'+ symbol);
          const deployReceipt = await deployTx.wait();
          if(deployReceipt.status !== 1){
            this.showError("Validator dest ERC20 deploy Tx failed.");
            this.setState({fetching: false});
            return;
          }

          this.setState({message: 'Adding coinAddress to source bridge as well...'})
          const deployedCoin = await destBridge.getDstCoin(srcErc20Contract);

          const addCoinTx = await bridge.addDestination(deployedCoin, srcErc20Contract);
          const addCoinReceipt = await addCoinTx.wait();
          if(addCoinReceipt.status !== 1){
            this.showError("Validator dest ERC20 add to source Tx failed.");
            this.getData();
            return;
          } 
        }

        this.setState({message: 'Adding a release...'})
        const addReleaseTx = await destBridge.addRelease(bridgeId, bridgeLock.srcChainId, srcErc20Contract, bridgeLock.sender, bridgeLock.receiver, bridgeLock.amount, bridgeLock.hashlock);
        const addReleaseReceipt = await addReleaseTx.wait();
        if(addReleaseReceipt.status !== 1){
          this.showError("Validator add release Tx failed.");
        }
      } catch(error){
        this.showError(error.message);
      }

      this.getData();
    }).on('CoinReleased', async (bridgeId: any, preimage: any) => {
      try {
        this.setState({message: 'Coin released, locking bridge on source chain...'})
        const bridgeStruct = (await bridge.getBridgeLocks()).find((b: any) => b.id === bridgeId);
        const srcBridge = this.bridges[bridgeStruct.srcChainId];

        const lockBridgeTx = await srcBridge.lockBridge(bridgeId, preimage);
        const lockBridgeReceipt = await lockBridgeTx.wait();
        if(lockBridgeReceipt.status !== 1){
          this.showError("Validator lock src bridge Tx failed.");
        }
      } catch(error){
        this.showError(error.message);
        this.setState({fetching: false});
      }
      this.getData();
    }).on('CoinRefunded', async (bridgeId: any, preimage: any) => {
      this.setState({message: 'Coin Refunded, locking release on target chain...'})
      try{
        const bridgeStruct = (await bridge.getBridgeLocks()).find((b: any) => b.id === bridgeId);
        const destBridge = this.bridges[bridgeStruct.dstChainId];

        const lockDestinationReleaseTx = await destBridge.lockBridge(bridgeId, preimage);
        const lockDestRelReceipt = await lockDestinationReleaseTx.wait();
        if(lockDestRelReceipt.status !== 1){
          this.showError("Validator lock destination release Tx failed.");
        }
      } catch(error){
        this.showError(error.message);
        this.setState({fetching: false});
      }

      this.getData();
    }).on('BridgeLocked', async (bridgeLockId: any) => {
      this.getData();
    });
  }

  public getData = async () => {
    const bridgeContract = getContract(this.bridges[this.state.chainId].address, Bridge.abi, this.state.library, this.state.address);
    const availableCoins: string[] = await bridgeContract.getAvailableCoins();

    const coins: ICoin[] = [];
    for (const coinAddr of availableCoins) {
      const coinContract = getContract(coinAddr, ERC20, this.state.library, this.state.address);
      coins.push({address: coinAddr, symbol: await coinContract.symbol()});
    }
    
    let totalBridges = (await bridgeContract.getBridgeLocks()).filter((a: any) => (a.sender.toLowerCase() === this.state.address || a.receiver.toLowerCase() === this.state.address ));

    totalBridges = totalBridges.map((a: any) => {
      const bridgeLock = {
        id: a.id,
        coin: a.coin,
        amount: web3.utils.fromWei(a.amount.toString()),
        active: a.active,
        sender: a.sender,
        receiver: a.receiver,
        srcChainId: a.srcChainId,
        dstChainId: a.dstChainId,
      };

      return bridgeLock;
    });

    const bridges = totalBridges.filter((a: any) => a.sender.toLowerCase() === this.state.address && a.srcChainId === this.state.chainId);
    const releases = totalBridges.filter((a: any) => a.receiver.toLowerCase() === this.state.address && a.dstChainId === this.state.chainId);

    for( const bridge of bridges) {
      const coinContract = getContract(bridge.coin, ERC20, this.state.library, this.state.address);
      bridge.symbol = await coinContract.symbol();
    }

    for (const release of releases) {
      const erc20 = await bridgeContract.getDstCoin(release.coin);
      const coinContract = getContract(erc20, ERC20, this.state.library, this.state.address);
      release.symbol = await coinContract.symbol();
    }

    await this.setState({
      coins,
      coinSelected: '',
      destinationNetwork: '',
      srcBridge: bridgeContract,
      releaseAddress: '',
      coinAmount: '',
      coinBalance: '',
      bridgeSecret: '',
      refundSecret: '',
      releaseSecret: '',
      selectedBridgeLockId: '',
      selectedReleaseLockId: '',
      bridgeLocks: bridges,
      releaseLocks: releases,
      fetching: false,
    });
  }

  public onConnect = async () => {
    if (window.ethereum.networkVersion !== this.state.networkSelected) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: web3.utils.toHex(Number(this.state.networkSelected)) }],
        });
      } catch (err) {
        console.log(err);
      }
    }

    this.provider = await this.web3Modal.connect();

    const library = new Web3Provider(this.provider);

    const network = await library.getNetwork();

    const address = this.provider.selectedAddress ? this.provider.selectedAddress : this.provider?.accounts[0];

    await this.setState({
      library,
      chainId: network.chainId,
      address,
      connected: true,
    });

    this.getData();

    await this.subscribeToProviderEvents(this.provider);
  };
  
  public subscribeToProviderEvents = async (provider:any) => {
    if (!provider.on) {
      return;
    }

    provider.on("accountsChanged", this.changedAccount);
    provider.on("chainChanged", this.networkChanged);
    provider.on("disconnect", this.close);

    await this.web3Modal.off('accountsChanged');
  };

  public async unSubscribe(provider:any) {
    // Workaround for metamask widget > 9.0.3 (provider.off is undefined);
    window.location.reload(false);
    if (!provider.off) {
      return;
    }

    provider.off("accountsChanged", this.changedAccount);
    provider.off("chainChanged", this.networkChanged);
    provider.off("disconnect", this.close);
  }

  public changedAccount = async (accounts: string[]) => {
    if(!accounts.length) {
      // Metamask Lock fire an empty accounts array 
      await this.resetApp();
    } else {
      await this.setState({ address: accounts[0] });
      this.getData();
    }
  }

  public networkChanged = async (networkId: number) => {
    const library = new Web3Provider(this.provider);
    const network = await library.getNetwork();
    const chainId = network.chainId;
    await this.setState({ chainId, library });

    this.getData();
  }
  
  public close = async () => {
    this.resetApp();
  }

  public getNetwork = () => getChainData(this.state.chainId).network;

  public getProviderOptions = () => {
    const providerOptions = {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          infuraId: process.env.REACT_APP_INFURA_ID
        }
      }
    };
    return providerOptions;
  };

  public resetApp = async () => {
    await this.web3Modal.clearCachedProvider();
    localStorage.removeItem("WEB3_CONNECT_CACHED_PROVIDER");
    localStorage.removeItem("walletconnect");
    await this.unSubscribe(this.provider);

    this.setState({ ...INITIAL_STATE });

  };
 
  public onNetworkSelected = async (networkSelected: string) => {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: web3.utils.toHex(Number(networkSelected))}],
        });
        this.setState({networkSelected, coins: []})
      } catch (err) {
        this.showError(err);
      }
  }

  public onCoinSelect = async (coinIndex: any) => {
    const coinAddress = this.state.coins[Number(coinIndex)].address;
    const erc20 = getContract(coinAddress, ERC20, this.state.library, this.state.address);

    const amount = await erc20.balanceOf(this.state.address);
    const isSelectedCoinOriginal = await this.state.srcBridge.isCoinOriginal(coinAddress);

    this.setState({
      coinSelected: coinIndex,
      coinBalance: amount,
      isSelectedCoinOriginal,
    });
  }

  public onClickBridge = async () => {
    const amount = web3.utils.toWei(this.state.coinAmount);
    
    if(this.state.coinBalance.lt(amount)){
      this.showError("Entered amount bigger than this addresses' balance.");
      return;
    }

    try {
      const erc20Address = this.state.coins[this.state.coinSelected].address;
      const erc20 = getContract(erc20Address, ERC20, this.state.library, this.state.address);

      const hashlock = web3.utils.keccak256(ethers.utils.hexZeroPad(web3.utils.asciiToHex(this.state.bridgeSecret, 32), 32));

      this.setState({message: 'Bridging coin...', fetching: true});

      let bridgeReceipt;
      // if the selected coin is an original one, aprove is needed because a transfer type of lock is to be used
      if(this.state.isSelectedCoinOriginal){
        const aproveTx = await erc20.approve(this.state.srcBridge.address, amount);
        const aproveReceipt = await aproveTx.wait();

        if (aproveReceipt.status !== 1){
          this.showError("Aprove Tx for the bridge Tx failed.");
          this.setState({fetching: false});
          return;
        }

        const bridgeTx = await this.state.srcBridge.bridgeCoin(erc20Address, this.state.releaseAddress, amount, hashlock, this.state.destinationNetwork);
        bridgeReceipt = await bridgeTx.wait();
      // else a burn type of bridge lock is to be used
      // this is basically in case of a bridge back to original coin
      } else {
        const bridgeTx = await this.state.srcBridge.bridgeBurnCoin(erc20Address, this.state.releaseAddress, amount, hashlock, this.state.destinationNetwork);
        bridgeReceipt = await bridgeTx.wait();
      }

      if(bridgeReceipt.status !== 1){
        this.showError("Bridge Tx failed.")
        this.setState({fetching: false});
      }

      this.showSuccess(bridgeReceipt.transactionHash);
    } catch (error) {
      this.showError(error.message);  
      this.setState({fetching: false});
    }
  }

  public onClickRefund = async () => {
    this.setState({message: 'Refunding coin...', fetching: true});

    try {
      // chech if the source coin that was bridged is an original one
      const coinAddress = await this.state.srcBridge.getBridgeLockSrcCoin(this.state.selectedBridgeLockId);
      const isRefundCoinOrig = await this.state.srcBridge.isCoinOriginal(coinAddress);

      let refundTx;
      // if the coin is an original, use a transfer type of refund
      if(isRefundCoinOrig) {
        refundTx = await this.state.srcBridge.refundTransfer(
          this.state.selectedBridgeLockId, 
          ethers.utils.hexZeroPad(web3.utils.asciiToHex(this.state.refundSecret, 32), 32)
        );
      // else use a mint type of refund
      } else {
        refundTx = await this.state.srcBridge.refundMint(
          this.state.selectedBridgeLockId, 
          ethers.utils.hexZeroPad(web3.utils.asciiToHex(this.state.refundSecret, 32), 32)
        );
      }

      const refundReceipt = await refundTx.wait();
      if(refundReceipt.status !== 1){
        this.showError("Refund Tx failed.")
        this.setState({fetching: false});
      }

      this.showSuccess(refundReceipt.transactionHash);
    } catch (error) {
      this.setState({fetching: false});
      this.showError(error.message);  
    }
  }

  public onClickRelease = async () => {
    this.setState({message: 'Releasing coin...', fetching: true});
    try {
      // get destination coin and check if it is set as original on the destination bridge
      // in this case the destination bridge is the one the metamask wallet is connected to
      const dstCoinAddr = await this.state.srcBridge.getDstCoinByBridgelockId(this.state.selectedReleaseLockId);
      const isReleaseDstCoinOrig = await this.state.srcBridge.isCoinOriginal(dstCoinAddr);
      let releaseTx;

      // if destination coin is original - use a transfer type of release
      if(isReleaseDstCoinOrig){
        releaseTx = await this.state.srcBridge.releaseTransferCoin(
          this.state.selectedReleaseLockId, 
          ethers.utils.hexZeroPad(web3.utils.asciiToHex(this.state.releaseSecret, 32), 32)
        );
      // else use a mint type of release
      } else {
        releaseTx = await this.state.srcBridge.releaseMintCoin(
          this.state.selectedReleaseLockId, 
          ethers.utils.hexZeroPad(web3.utils.asciiToHex(this.state.releaseSecret, 32), 32)
        );
      }

      const releaseReceipt = await releaseTx.wait();
      if(releaseReceipt.status !== 1){
        this.showError("Release Tx failed.")
        this.setState({fetching: false});
      }

      this.showSuccess(releaseReceipt.transactionHash);
    } catch (err) {
      this.showError(err.message);
      this.setState({fetching: false});
    }
  }

  public showError = (message: string) => {
    this.setState({
      showError: true,
      errorMessage: message,
    })
  }

  public showSuccess = (message: string) => {
    this.setState({
      showSuccess: true,
      txHash: message,
    })
  }

  public render = () => {
    const {
      address,
      connected,
      chainId,
      coins,
      coinSelected,
      destinationNetwork,
      fetching,
      coinAmount,
      coinBalance,
      bridgeSecret,
      refundSecret,
      releaseSecret,
      networkSelected,
      bridgeLocks,
      releaseLocks,
      selectedBridgeLockId,
      message,
      selectedReleaseLockId,
      releaseAddress,
    } = this.state;
    return (
      <SLayout>
        <Column maxWidth={1000} spanHeight>
          <Header
            connected={connected}
            address={address}
            chainId={chainId}
            killSession={this.resetApp}
          />
          {this.state.showError && 
          <Alert severity = {"error"}  
            onClose = {() => this.setState({showError: false, errorMessage: ''})}
          >
            <AlertTitle>Error</AlertTitle>
            {this.state.errorMessage}
          </Alert>}
          {this.state.showSuccess && 
          <Alert severity = {"success"}  
            onClose = {() => this.setState({showSuccess: false, txHash: ''})}
          >
            <AlertTitle>Success</AlertTitle>
            <a href={`https://${constants.CHAINS.find((c) => c.chainId === this.state.networkSelected).name}.etherscan.io/tx/${this.state.txHash}`} target="_blank">
              {this.state.txHash}
            </a>
          </Alert>}
          <FormControl >
            <InputLabel id="network-select-label">Network</InputLabel>
              <Select
                  fullWidth 
                  labelId="network-select-label"
                  id="network-select"
                  value={this.state.networkSelected}
                  label="network"
                  onChange={(event: any) => this.onNetworkSelected(typeof event.target.value === 'string' ? event.target.value : '')}
              >
                  {constants.CHAINS.map((chain, i) => <MenuItem key={i} value={chain.chainId}>{chain.name}</MenuItem>)} 
              </Select>
          </FormControl>  
          <SContent>
            <SColumn>
              <BridgeForm 
                connected = {connected}
                selectedNetwork = {networkSelected}
                coins = {coins}
                destinationNetwork = {destinationNetwork}
                selectedCoin = {coinSelected}
                coinAmount = {coinAmount}
                coinBalance = {web3.utils.fromWei(coinBalance.toString())}
                secret = {bridgeSecret}
                releaseAddress = {releaseAddress}
                fetching = {fetching}
                onCoinSelect = {this.onCoinSelect}
                onDestinationNetworkSelected = {(destinationNetwork) => this.setState({destinationNetwork})}
                onCoinAmountChange = {(value: string) => this.setState({coinAmount :value})}
                onChangeReleaseAddress = {(releaseAddress: string) => this.setState({releaseAddress})}
                onSecretChange = {(bridgeSecret: string) => this.setState({bridgeSecret})}
                onClickBridge = {this.onClickBridge}
              />
            </SColumn>
            <SColumn>
              <RefundForm
                fetching = {fetching}
                bridgeLocks = {bridgeLocks.filter((b: any) => b.active)}
                selectedBridgeLockId = {selectedBridgeLockId}
                secret = {refundSecret}
                onClickRefund = {this.onClickRefund}
                onChangeSelectedRefund = {(selectedBridgeLockId: string) => this.setState({selectedBridgeLockId})}
                onSecretChange = {(refundSecret: string) => this.setState({refundSecret})}
              />
            </SColumn>
            <SColumn>
              <ReleaseForm
                fetching = {fetching}
                releaseLocks={releaseLocks.filter((b: any) => b.active)}
                selectedReleaseLockId = {selectedReleaseLockId}
                secret = {releaseSecret}
                onChangeSelectedRelease = {(selectedReleaseLockId: string) => this.setState({selectedReleaseLockId})}
                onSecretChange = {(releaseSecret: string) => this.setState({releaseSecret})}
                onClickRelease = {this.onClickRelease}
              />
            </SColumn>
            <SColumn>
              <div>Previous bridges</div>
              <List dense = {true}>
                  {bridgeLocks.filter((b:any) => !b.active).map((bridge: any, i: number) => <ListItem key={i}>{bridge.amount + ' ' + bridge.symbol}</ListItem>)}
              </List>
            </SColumn>
            <SColumn>
              <div>Previous releases</div>
              <List>
                {releaseLocks.filter((b:any) => !b.active).map((bridge: any, i: number) => <ListItem key={i}>{bridge.amount + ' ' + bridge.symbol}</ListItem>)}
              </List>
            </SColumn>
            {fetching ? (
              <Column center>
                <SContainer>
                  <Loader />
                  <Message>{message}</Message>
                </SContainer>
              </Column>
            ) : (
                <SLanding center>
                  {!this.state.connected && this.state.networkSelected !== '' && <ConnectButton onClick={this.onConnect} />}
                </SLanding>
              )}
          </SContent>
        </Column>
      </SLayout>
    );
  };

}

export default App;
