# ERC20Bridge
## Dictionary
**bridging** - as a noun - A single `to-from` transition of a coin.That means that if a bridged coin is being bridged back to its original network, this is another **bridging**.

**original coin** - a coin that was not deployed by the contract. Could be any ERC20 coin.

**deployed/bridge coin** - a coin that was deployed by the bridge contract. It can mint and burn coins and is like a wrapper for the original coin, but on a certain destination network.

**source bridge contract** - the contract on the network from which the **bridging** began.

**destination bridge contract** - the contract on the network to which the **bridging** is supposed to end.

**source/destination network** - similarly to the above

**refund** - the user receives the bridged coins back on the source network for the **bridging**

**release** - the use receives the bridged coins on the destination network for the **bridging**

## Segments
### Bridge contracts
All the chains that are bridged together have the same bridge contract. This UI implementation works with 2, but could easily be made to work with more, since the bridgelocks hold source and destination chainIds.

The contract consists of a **BridgeLocker** and the **ERC20Bridge** which inherits the **BridgeLocker**. The **BridgeLocker** has all the logic for creating, deactivating and getting **bridgeLocks** - basically like a storage. **BridgeLock** is a single entry for a bridge and holds the needed info for both bridge contracts to use. Both bridge contracts hold the same entry for **bridgeLock** with same fields.
The **ERC20Bridge** contract holds the coins storage, which can add more `original` coins, deploy coins as destinations for the original ones etc, the functions for the users to interact with concerning the bridging, and the functions used by the event listener/validator.

### Event listener / validator
In this case it is just an event listener still on the front end, that listens for certain events emited from each contracts and takes measures. For instance - when a **CoinBridged** event is emited on one contract, the listener finds the destination contract for that **bridging**, checks if the bridged coin is original, deploys contract if needed and creates a release on the destination bridge contract.

### UI
As the name suggests - the user interface, but also makes a few checks in order to decide on which bridge or refund function to use for example, because they are different for the **original** and for the **deployed** coins.

## Workflow
### User side
1. The user selects network from which to bridge and connects his wallet.
2. Then he selects a coin from a dropdown and when it is selected the ui shows his balance for that coin above the input for amount to bridge.
3. The use enters **destination chain**, amount, receiver address on the **destination chain** and a secret, which is needed for **refund** and **release**
4. The UI checks what needs to be done (approving allowance, choosing which function to use etc.). If the coin is **original** it is being sent to the contract address, if it is a **deployed** one, it is being burned.
5. After the user aproves the txs (2 txs are being made if the coin needs aproving first) and the **event listener** does all its work, a **bridgeLock** is created and can now be either **refunded** or **released**.
6. If the user wants to **refund** it, he enters the secret, clicks on the **refund** button and aproves the tx on the Metamask popup.
7. if the user wants to **release** it on the **destination chain**, he has to switch the network from the drop down on top of the screen.
8. After he aproves the metamask popup to switch the network, he can then enter a secret, click on the **release** button and aprove the tx.
9. The user will receive the balance in either a **bridge coin**, which is minted from the contract, or an **original coin** that is being transfered from the contract address, if he was bridging back.

### Event Listenet
#### CoinBridged event
1. When that event is emitted, the listeners' work is to check if a coin should be deployed on the **destination** bridge and calls the function for that if it should.
2. After the coin logistics is done, the listener then adds the **release** (basically adds the **bridgeLock** from the **source** bridge to the **destiantion** bridge).

#### CoinReleased
This means a coin was **released** on the **destination chain**. Since the **source contract** needs to deactivate/lock the **bridgeLock** on the **source chain** as well, it does just that.

#### CoinRefunded
This means a coin was **refunded** on the **source chain**. Since the **destination contract** needs to deactivate/lock the **bridgeLock** on the **destination chain** as well, it does just that.

#### BridgeLocked
This is just listened to so the list of available and historical **bridgeLocks** can be refreshed.

## To run:
1. Deploy bridge with 3 coins on rinkeby: `npm hardhat deploy --network rinkeby`
2. Deploy bridge with 3 coins on ropsten: `npm hardhat deploy --network ropsten`
3. Fill an .env file in /ui with the addresses of the bridges and some wallets to sign tx as a validator
4. from /ui folder run `npm run start`
