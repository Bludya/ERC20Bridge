import * as React from 'react';
import styled from 'styled-components';
import { getContract } from './helpers/ethers';
import Bridge from './constants/abis/ERC20Bridge.json'
import Web3Modal from 'web3modal';
import web3 from 'web3';
import crypto from 'crypto';
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
import RefundForm, { IBridgeLock } from './components/RefundForm';
import ReleaseForm from './components/ReleaseForm';
import Button from './components/Button';

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
  width: 33%;
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
  connected: boolean;
  chainId: number;
  pendingRequest: boolean;
  networkSelected: string;
  coinSelected: string;
  coinBalance: number;
  coinAmount: string;
  coins: ICoin[];
  bridgeSecret: string;
  refundSecret: string;
  releaseSecret: string;
  bridgeLocks: IBridgeLock[];
  selectedBridgeLockId: string;
  releaseLocks: IBridgeLock[];
  selectedReleaseLockId: string;
  releaseAddress: string;
}

const INITIAL_STATE: IAppState = {
  fetching: false,
  message: '',
  address: '',
  library: null,
  connected: false,
  chainId: 4,
  pendingRequest: false,
  networkSelected: '4',
  coinSelected: '',
  coinBalance: 0,
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
};

class App extends React.Component<any, any> {
  // @ts-ignore
  public web3Modal: Web3Modal;
  public state: IAppState;
  public provider: any;

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
    
    this.eventListener();
  }

  public componentDidMount() {
    if (this.web3Modal.cachedProvider) {
      this.onConnect();
    }
  }

  public sha256 = (x: string) => crypto.createHash('sha256').update(ethers.utils.hexZeroPad(web3.utils.asciiToHex(x, 32), 32)).digest();

  public eventListener = async () => {
 
    const rinkebyProvider = new ethers.providers.InfuraProvider('rinkeby', process.env.REACT_APP_INFURA_ID);
    const rinkebyWallet = new ethers.Wallet(process.env.REACT_APP_VALIDATOR_PRIV_KEY_RINKEBY || '', rinkebyProvider);
    const rinkebyBridge = ethers.ContractFactory.getContract(process.env.REACT_APP_BRIDGE_ADDRESS_RINKEBY || '', Bridge.abi, rinkebyWallet);

    const ropstenProvider = new ethers.providers.InfuraProvider('ropsten', process.env.REACT_APP_INFURA_ID);
    const ropstenWallet = new ethers.Wallet(process.env.REACT_APP_VALIDATOR_PRIV_KEY_ROPSTEN || '', ropstenProvider);
    const ropstenBridge = ethers.ContractFactory.getContract(process.env.REACT_APP_BRIDGE_ADDRESS_ROPSTEN || '', Bridge.abi, ropstenWallet);

    await this.addListeners(rinkebyBridge, ropstenBridge);
    await this.addListeners(ropstenBridge, rinkebyBridge);
  }

  public addListeners(srcBridge: ethers.Contract, destBridge: ethers.Contract) {

    srcBridge.on('CoinBridged', async (bridgeLockId: any) => {
      this.setState({message: 'Coin bridged, adding a release...'})
      try {
        const bridgeLock = await srcBridge.getBridgeLock(bridgeLockId);
        const wallet = srcBridge.signer;
        const srcErc20 = ethers.ContractFactory.getContract(bridgeLock.erc20Contract, ERC20, wallet);
        const symbol = await srcErc20.symbol();
        const name = await srcErc20.name();

        const bridgeLockState: IBridgeLock = {
          id: bridgeLockId,
          amount: web3.utils.fromWei(bridgeLock.amount.toString()).toString(),
          symbol,
          open: true
        }

        this.state.bridgeLocks.push(bridgeLockState);

        this.setState({});

        const destContractExists = await destBridge.destinationExists(bridgeLock.erc20Contract);
        if(!destContractExists) {
          this.setState({message: 'Coin does not yet exist on target chain, deploying ERC20...'})

          const deployTx = await destBridge.deployDestErc20(bridgeLock.erc20Contract,'Bridged ' + name, 'B'+ symbol);
          const deployReceipt = await deployTx.wait();
          if(deployReceipt.status !== 1){
            this.showError("Validator dest ERC20 deploy Tx failed.");
            this.setState({fetching: false});
            return;
          }
        }
        this.setState({message: 'Adding a release...'})

        const amount = bridgeLock.amount;
        const addReleaseTx = await destBridge.addRelease(bridgeLockId, bridgeLock.erc20Contract, amount, bridgeLock.hashlock);
        const addReleaseReceipt = await addReleaseTx.wait();
        if(addReleaseReceipt.status !== 1){
          this.showError("Validator add release Tx failed.");
          this.setState({fetching: false});
          return;
        }
        const releaseLock: IBridgeLock = {
          id: bridgeLockId,
          amount,
          symbol: typeof symbol === 'string' ? symbol : '',
          open: true,
        }

        this.state.releaseLocks.push(releaseLock);
        this.setState({fetching: false});
      } catch(error){
        this.showError(error.message);
        this.setState({fetching: false});
      }
    }).on('CoinReleased', async (bridgeLockId: any, preimage: any) => {
      console.log("CoinReleased")
      try {
        this.setState({message: 'Coin released, locking bridge on source chain...'})
        const lockBridgeTx = await destBridge.lockBridge(bridgeLockId, preimage);
        const lockBridgeReceipt = await lockBridgeTx.wait();
        if(lockBridgeReceipt.status !== 1){
          this.showError("Validator lock src bridge Tx failed.");
        }

        this.setState({
          bridgeLocks: this.state.bridgeLocks.filter(a => a.id !== bridgeLockId),
          releaseBridgeLocks: this.state.releaseLocks.filter(a => a.id !== bridgeLockId),
          fetching: false
        });
      } catch(error){
        this.showError(error.message);
        this.setState({fetching: false});
      }
    }).on('CoinRefunded', async (bridgeLockId: any, preimage: any) => {
      this.setState({message: 'Coin Refunded, locking release on target chain...'})
      console.log(bridgeLockId);
      console.log(preimage);
      try{
        const lockDestinationReleaseTx = await destBridge.lockRelease(bridgeLockId, preimage);
        const lockDestRelReceipt = await lockDestinationReleaseTx.wait();
        if(lockDestRelReceipt.status !== 1){
          this.showError("Validator lock destination release Tx failed.");
        }

        this.setState({
          bridgeLocks: this.state.bridgeLocks.filter(a => a.id !== bridgeLockId), 
          releaseBridgeLocks: this.state.releaseLocks.filter(a => a.id !== bridgeLockId),
          selectedBridgeLockId: '',
          fetching: false}
        );
      } catch(error){
        this.showError(error.message);
        this.setState({fetching: false});
      }
    }).on('CoinRefundLocked', async (bridgeLockId: any) => {
      console.log("CoinRefundLocked")
      this.setState({
        bridgeLocks: this.state.bridgeLocks.filter(a => a.id !== bridgeLockId), 
        releaseBridgeLocks: this.state.releaseLocks.filter(a => a.id !== bridgeLockId),
        fetching: false
      });
    })
  }

  public onConnect = async () => {
    if (window.ethereum.networkVersion !== this.state.networkSelected) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: web3.utils.toHex(this.state.networkSelected) }],
        });
      } catch (err) {
        console.log(err);
      }
    }

    this.provider = await this.web3Modal.connect();

    const library = new Web3Provider(this.provider);

    const network = await library.getNetwork();

    const address = this.provider.selectedAddress ? this.provider.selectedAddress : this.provider?.accounts[0];

    const bridgeAddress = this.state.chainId === constants.CHAIN_ID.RINKEBY ? process.env.REACT_APP_BRIDGE_ADDRESS_RINKEBY : process.env.REACT_APP_BRIDGE_ADDRESS_ROPSTEN;

    const bridgeContract = getContract(bridgeAddress || '', Bridge.abi, library, address);
    const availableCoins: string[] = await bridgeContract.getAvailableCoins();

    const coins: ICoin[] = [];
    for (const coinAddr of availableCoins) {
      const coinContract = getContract(coinAddr, ERC20, library, address);
      coins.push({address: coinAddr, symbol: await coinContract.symbol()});
    }

    await this.setState({
      library,
      chainId: network.chainId,
      address,
      connected: true,
      coins,
      coinSelected: '',
      secret: '',
    });

    await this.subscribeToProviderEvents(this.provider);
  };
  
  public subscribeToProviderEvents = async (provider:any) => {
    if (!provider.on) {
      return;
    }

    provider.on("accountsChanged", this.changedAccount);
    provider.on("networkChanged", this.networkChanged);
    provider.on("close", this.close);

    await this.web3Modal.off('accountsChanged');
  };

  public async unSubscribe(provider:any) {
    // Workaround for metamask widget > 9.0.3 (provider.off is undefined);
    window.location.reload(false);
    if (!provider.off) {
      return;
    }

    provider.off("accountsChanged", this.changedAccount);
    provider.off("networkChanged", this.networkChanged);
    provider.off("close", this.close);
  }

  public changedAccount = async (accounts: string[]) => {
    if(!accounts.length) {
      // Metamask Lock fire an empty accounts array 
      await this.resetApp();
    } else {
      await this.setState({ address: accounts[0] });
    }
  }

  public networkChanged = async (networkId: number) => {
    const library = new Web3Provider(this.provider);
    const network = await library.getNetwork();
    const chainId = network.chainId;
    this.setState({ chainId, library });
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
 
  public onClickChangeNetwork = async () => {
    const networkSelected = this.state.chainId === constants.CHAIN_ID.RINKEBY ? constants.CHAIN_ID.ROPSTEN : constants.CHAIN_ID.RINKEBY;
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: web3.utils.toHex(networkSelected)}],
        });
        this.setState({networkSelected, connected: false, coins: []})
      } catch (err) {
        this.showError(err);
      }
  }

  public onCoinSelect = async (coinIndex: any) => {
    const coinAddress = this.state.coins[Number(coinIndex)].address;
    const library = new Web3Provider(this.provider);
    const address = this.provider.selectedAddress ? this.provider.selectedAddress : this.provider?.accounts[0];
    const erc20 = getContract(coinAddress, ERC20, library, address);

    const amount = await erc20.balanceOf(address);

    this.setState({
      coinSelected: coinIndex,
      coinBalance: amount
    });
  }

  public onClickBridge = async () => {
    this.setState({message: 'Approving allowance for coin...', fetching: true});

    try {
      const library = new Web3Provider(this.provider);
      const address = this.provider.selectedAddress ? this.provider.selectedAddress : this.provider?.accounts[0];

      const bridgeAddress = this.state.chainId === constants.CHAIN_ID.RINKEBY ? process.env.REACT_APP_BRIDGE_ADDRESS_RINKEBY : process.env.REACT_APP_BRIDGE_ADDRESS_ROPSTEN;
      const bridgeContract = getContract(bridgeAddress || '', Bridge.abi, library, address);
      const erc20Address = this.state.coins[this.state.coinSelected].address;
      const erc20 = getContract(erc20Address, ERC20, library, address);
      const amount = web3.utils.toWei(this.state.coinAmount);

      const hashlock = web3.utils.keccak256(ethers.utils.hexZeroPad(web3.utils.asciiToHex(this.state.bridgeSecret, 32), 32));

      const aproveTx = await erc20.approve(bridgeAddress, amount);
      const aproveReceipt = await aproveTx.wait();
      if (aproveReceipt.status !== 1){
        this.showError("Aprove Tx for the bridge Tx failed.");
        this.setState({fetching: false});
        return;
      }

      this.setState({message: 'Bridging coin...'});
      const bridgeTx = await bridgeContract.bridgeCoin(erc20Address, amount, hashlock);
      const bridgeReceipt = await bridgeTx.wait();

      if(bridgeReceipt.status !== 1){
        this.showError("Bridge Tx failed.")
        this.setState({fetching: false});
      }
    } catch (error) {
      this.showError(error.message);  
      this.setState({fetching: false});
    }

    this.setState({
      bridgeSecret: '',
      coinAmount: '',
    })
  }

  public onClickRefund = async () => {
    this.setState({message: 'Refunding coin...', fetching: true});
    try {
      const library = new Web3Provider(this.provider);
      const address = this.provider.selectedAddress ? this.provider.selectedAddress : this.provider?.accounts[0];

      const bridgeAddress = this.state.chainId === constants.CHAIN_ID.RINKEBY ? process.env.REACT_APP_BRIDGE_ADDRESS_RINKEBY : process.env.REACT_APP_BRIDGE_ADDRESS_ROPSTEN;
      const bridgeContract = getContract(bridgeAddress || '', Bridge.abi, library, address);
      const refundTx = await bridgeContract.refund(
        this.state.selectedBridgeLockId, 
        ethers.utils.hexZeroPad(web3.utils.asciiToHex(this.state.refundSecret, 32), 32)
      );

      const refundReceipt = await refundTx.wait();
      if(refundReceipt.status !== 1){
        this.showError("Refund Tx failed.")
        this.setState({fetching: false});
      }
    } catch (error) {
      this.setState({fetching: false});
      this.showError(error.message);  
    }

    this.setState({
      refundSecret: '',
      selectedBridgeLockId: '',
    })
  }

  public onClickRelease = async () => {
    try {
      const library = new Web3Provider(this.provider);
      const address = this.provider.selectedAddress ? this.provider.selectedAddress : this.provider?.accounts[0];

      const bridgeAddress = this.state.chainId === constants.CHAIN_ID.RINKEBY ? process.env.REACT_APP_BRIDGE_ADDRESS_RINKEBY : process.env.REACT_APP_BRIDGE_ADDRESS_ROPSTEN;
      const bridgeContract = getContract(bridgeAddress || '', Bridge.abi, library, address);
      const releaseTx = await bridgeContract.releaseCoin(
        this.state.releaseAddress,
        this.state.selectedReleaseLockId, 
        ethers.utils.hexZeroPad(web3.utils.asciiToHex(this.state.releaseSecret, 32), 32)
      );

      const releaseReceipt = await releaseTx.wait();
      if(releaseReceipt.status !== 1){
        this.showError("Release Tx failed.")
        this.setState({fetching: false});
      }
    } catch (err) {
      this.showError(err);
      this.setState({fetching: false});
    }

    this.setState({
      refundSecret: '',
      selectedReleaseLockId: '',
      releaseAddress: '',
    })
  }

  public showError = (message: string, e?: any) => {
    console.log(message, e);
  }

  public render = () => {
    const {
      address,
      connected,
      chainId,
      coins,
      coinSelected,
      fetching,
      coinAmount,
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
          <Button disabled={fetching} onClick={() => this.onClickChangeNetwork()}>Switch network</Button>
          <SContent>
            <SColumn>
              <h3>Bridge coins</h3>
              <BridgeForm 
                connected = {connected}
                selectedNetwork = {networkSelected}
                coins = {coins}
                selectedCoin = {coinSelected}
                onCoinSelect = {this.onCoinSelect}
                coinAmount = {coinAmount}
                secret = {bridgeSecret}
                onClickBridge = {this.onClickBridge}
                onCoinAmountChange = {(value: string) => this.setState({coinAmount :value})}
                onSecretChange = {(bridgeSecret: string) => this.setState({bridgeSecret})}
                fetching = {fetching}
              />
            </SColumn>
              <SColumn>
                  <RefundForm
                    bridgeLocks = {bridgeLocks}
                    fetching = {fetching}
                    selectedBridgeLockId = {selectedBridgeLockId}
                    secret = {refundSecret}
                    onClickRefund = {this.onClickRefund}
                    onChangeSelectedRefund = {(selectedBridgeLockId: string) => this.setState({selectedBridgeLockId})}
                    onSecretChange = {(refundSecret: string) => this.setState({refundSecret})}
                  />
              </SColumn>
              <SColumn>
                <ReleaseForm
                  releaseLocks={releaseLocks}
                  secret = {releaseSecret}
                  selectedReleaseLockId = {selectedReleaseLockId}
                  onChangeSelectedRefund = {(selectedReleaseLockId: string) => this.setState({selectedReleaseLockId})}
                  onSecretChange = {(releaseSecret: string) => this.setState({releaseSecret})}
                  fetching = {fetching}
                  onClickRelease = {this.onClickRelease}
                  releaseAddress = {releaseAddress}
                  onChangeReleaseAddress = {(releaseAddress: string) => this.setState({releaseAddress})}
                />
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
