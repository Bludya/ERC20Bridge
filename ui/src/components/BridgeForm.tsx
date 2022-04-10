import { FormControl, Input, InputLabel, MenuItem, Select } from "@material-ui/core"
import React from "react"
import Button from "./Button"
import Column from "./Column"

export interface ICoin {
    address: string,
    symbol: string,
}

interface IBridgeFormProps {
    connected: boolean
    selectedNetwork: string
    coins: ICoin[]
    selectedCoin: string
    releaseAddress: string
    coinAmount: string
    coinBalance: string
    secret: string
    fetching: boolean
    onCoinSelect: (value: string) => void
    onCoinAmountChange: (value: string) => void
    onSecretChange: (value: string) => void
    onClickBridge: () => void
    onChangeReleaseAddress: (value: string) => void
  }
  

const BridgeForm = (props: IBridgeFormProps) => (
    <div className = {props.fetching ? '' : 'inactive'}>
        <Column>
            <h4>Bridge coins</h4>
            <FormControl >
                <InputLabel id="coin-select-label">Coin</InputLabel>
                <Select
                    fullWidth 
                    labelId="coin-select-label"
                    id="coin-select"
                    value={props.selectedCoin}
                    label="Coin"
                    onChange={(event) => props.onCoinSelect(typeof event.target.value === 'string' ? event.target.value : '')}
                >
                    {props.coins.map((coin, i) => <MenuItem key={i} value={i.toString()}>{coin.symbol}</MenuItem>)} 
                </Select>
            </FormControl>
            <FormControl>
                <InputLabel id="amount-label">Amount {props.coinBalance !== '0' ? `(max ${props.coinBalance})` : ''}</InputLabel>
                <Input
                    fullWidth 
                    type="number"
                    id="amount"
                    value={props.coinAmount}
                    onChange={(event) => props.onCoinAmountChange(typeof event.target.value === 'string' ? event.target.value : '')}
                />  
            </FormControl>
            <FormControl>
                <InputLabel id="address-label">Address</InputLabel>
                <Input
                    id="address"
                    fullWidth 
                    value={props.releaseAddress}
                    onChange={(event) => props.onChangeReleaseAddress(typeof event.target.value === 'string' ? event.target.value : '')}
                />  
            </FormControl>
            <FormControl>
                <InputLabel id="secret-label">Secret</InputLabel>
                <Input 
                    id="secret-bridge"
                    fullWidth 
                    value={props.secret}
                    onChange={(event) => props.onSecretChange(typeof event.target.value === 'string' ? event.target.value : '')}
                    type="password"
                />  
            </FormControl>
            <Button disabled={Number(props.coinAmount) === 0 || props.secret === '' || props.fetching} onClick={() => props.onClickBridge()}>Bridge</Button>
        </Column>
    </div>
)

export default BridgeForm;