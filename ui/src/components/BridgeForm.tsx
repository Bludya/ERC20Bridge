import { FormControl, Input, InputLabel, MenuItem, Select } from "@material-ui/core"
import React from "react"
import Button from "./Button"

export interface ICoin {
    address: string,
    symbol: string,
}

interface IBridgeFormProps {
    connected: boolean
    selectedNetwork: string
    coins: ICoin[]
    selectedCoin: string
    onCoinSelect: (value: string) => void
    coinAmount: string
    onCoinAmountChange: (value: string) => void
    onSecretChange: (value: string) => void
    secret: string
    onClickBridge: () => void
    fetching: boolean
  }
  

const BridgeForm = (props: IBridgeFormProps) => (
<>
    <FormControl >
        <InputLabel id="coin-select-label">Coin</InputLabel>
        <Select
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
        <InputLabel id="amount-label">Amount</InputLabel>
            <Input
            id="amount"
            value={props.coinAmount}
            onChange={(event) => props.onCoinAmountChange(typeof event.target.value === 'string' ? event.target.value : '')}
            />  
    </FormControl>
    <FormControl>
        <InputLabel id="Secret-label">Secret</InputLabel>
            <Input
            id="Secret"
            value={props.secret}
            onChange={(event) => props.onSecretChange(typeof event.target.value === 'string' ? event.target.value : '')}
            />  
    </FormControl>
    <Button disabled={Number(props.coinAmount) === 0 || props.secret === '' || props.fetching} onClick={() => props.onClickBridge()}>Bridge</Button>
</>)

export default BridgeForm;