# ERC20Bridge
### TODO in contract: 
1. Keep unreleased bridged tokens balanse until they are released, so a user can "unbridge them" in case of problems with the bridge on chain B.
2. Add validator functionality, where only validator can release tokens so that the bridge contract is not so easy to empty.

### TODO in frontend:
1. Everything ;)

## Workflow
Definitions: chain "A" is the chain **FROM** which tokens will be bridged. Chain "B" is the chain **TO** which tokens will be bridged.
1. User selects chain A.
    - The frontend automatically sets visually chain B.
    - The frontend queries the available coins and filters out coins that don't exist on both networks.
    - The frontend shows available coins for the user to chose from.
    - The frontend activates `Connect wallet` button.
2. User clicks on `Connect wallet` button to be able to interact on chain A.
    - Await - if successfull - activate coins to bridge.
3. The user chooses a coin to bridge.
    - The frontend queries the balance of the user on chain A and the balance of the bridge contract on chain B.
    - If there is an already bridged amount and still unreleased amount, subtract it from bridge balance on chain B to get the balance left to bridge.
    - The frontend shows the lower of the two balances to the user as available tokens to bridge, since if the bridge contract on chain B doesn't have the coins, he can't release them.
4. The user enters an amount to bridge.
    - The frontend checks the amount against the min and max and shows error and doesn't allow the bridge button to be active.
    - If the amount is correct, activate the bridge button.
5. The user clicks on `Bridge` button.
    - The frontend calls the `bridgeCoin` function on the bridge contract on chain A.
    - Await - if an error is returnes - show it, if successfull add amount to storage.
    - If bridged amount was 0 and now more, activate `Connect wallet` button for chain B. If bridged amount was more than 0, just refresh the amount shown as available to release on chain B.
    - Recalculate and refresh the amount available to bridge.
6. User clicks on `Connect wallet` for chain B.
    - Await - if successfull - activate `Release` button.
7. The user clicks on `Release` button.
    - The frontend calls the `releaseCoin` function on the bridge contract on chain B.
    - Await - if an error is returned - show it. 
    - If successfull - zero out the amount in storage, deactivate the release button.

