import * as React from 'react';
import styled from 'styled-components';
import { getContract } from './helpers/ethers';
import {
  REACT_APP_BRIDGE_ADDRESS_RINKEBY,
  REACT_APP_BRIDGE_ADDRESS_ROPSTEN
} from './constants/contracts';
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
import Button from './components/Button';
import Select from '@material-ui/core/Select';
import InputLabel  from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';
import MenuItem  from '@material-ui/core/MenuItem';
import ERC20 from "erc-20-abi";

const ROPSTEN_CHAIN_ID = 3
const RINKEBY_CHAIN_ID = 4

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

// @ts-ignore
const SBalances = styled(SLanding)`
  height: 100%;
  & h3 {
    padding-top: 30px;
  }
`;

interface ICoin {
  address: string,
  symbol: string,
}

interface IAppState {
  fetching: boolean;
  address: string;
  library: any;
  connected: boolean;
  chainId: number;
  pendingRequest: boolean;
  networkSelected: number;
  coinSelected: number;
  coins: ICoin[];
}

const INITIAL_STATE: IAppState = {
  fetching: false,
  address: '',
  library: null,
  connected: false,
  chainId: 1,
  pendingRequest: false,
  networkSelected: 4,
  coinSelected: 0,
  coins: [],
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
  }

  public componentDidMount() {
    if (this.web3Modal.cachedProvider) {
      this.onConnect();
    }
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

    const bridgeAddress = this.state.chainId === RINKEBY_CHAIN_ID ? REACT_APP_BRIDGE_ADDRESS_RINKEBY : REACT_APP_BRIDGE_ADDRESS_ROPSTEN;
    const bridgeContract = getContract(bridgeAddress, Bridge.abi, library, address);
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
    });

    await this.subscribeToProviderEvents(this.provider);
  };

  // public submitElectionResult = async () => {
  //   const { electionContract } = this.state;

  //   const dataArr = [
  //     'Idaho',
  //     51,
  //     50,
  //     24
	//   ];
		
	// 	await this.setState({ fetching: true });
	// 	const transaction = await electionContract.submitStateResult(dataArr);

	// 	await this.setState({ transactionHash: transaction.hash });
		
	// 	const transactionReceipt = await transaction.wait();
	// 	if (transactionReceipt.status !== 1) {
	// 		// React to failure
	// 	}		

  // };
  
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
 
  public onChangeSelectedNetwork = async (networkSelected: any) => {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: web3.utils.toHex(networkSelected)}],
        });
        this.setState({networkSelected})
      } catch (err) {
        console.log(err);
      }
  }

  public render = () => {
    const {
      address,
      connected,
      chainId,
      coins,
      coinSelected,
      fetching
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
          <SContent>
            <Column center>
              <FormControl >
                <InputLabel id="demo-simple-select-label">Source network</InputLabel>
                <Select
                  labelId="demo-simple-select-label"
                  id="demo-simple-select"
                  value={this.state.networkSelected}
                  label="Age"
                  
                  defaultValue={RINKEBY_CHAIN_ID}
                  onChange={(event) => this.onChangeSelectedNetwork(event.target.value)}
                >
                  <MenuItem value={`${ROPSTEN_CHAIN_ID}`}>Ropsten</MenuItem>
                  <MenuItem value={`${RINKEBY_CHAIN_ID}`}>Rinkeby</MenuItem>
                </Select>
              </FormControl>
              { connected &&
              <>
              { coins.length > 0 &&<FormControl >
                <InputLabel id="demo-simple-select-label">Coin</InputLabel>
                <Select
                  labelId="demo-simple-select-label"
                  id="demo-simple-select"
                  value={this.state.coinSelected}
                  label="Age"
                  onChange={(event) => this.setState({coinSelected: Number(event.target.value)})}
                >
                 {coins.map((coin, i) => <MenuItem key={i} value={i}>{coin.symbol}</MenuItem>)} 
                </Select>
              </FormControl>
              }
              {coinSelected !== -1 && <Button >Bridge</Button>}
              </>}
            </Column>
            {fetching ? (
              <Column center>
                <SContainer>
                  <Loader />
                </SContainer>
              </Column>
            ) : (
                <SLanding center>
                  {!this.state.connected && this.state.networkSelected !== 0 && <ConnectButton onClick={this.onConnect} />}
                </SLanding>
              )}
          </SContent>
        </Column>
      </SLayout>
    );
  };
}

export default App;
