import { FormControl, Input, InputLabel, MenuItem, Select } from "@material-ui/core"
import React from "react"
import Button from "./Button"
import Column from "./Column";

export interface IBridgeLock {
    id: string
    amount: string
    symbol: string
    open: boolean
}

interface IBridgeFormProps {
    bridgeLocks: IBridgeLock[]
    selectedBridgeLockId: string
    secret: string
    onClickRefund: () => void
    onChangeSelectedRefund: (value: string) => void
    onSecretChange: (value: string) => void
    fetching: boolean
}
  

const RefundForm = (props: IBridgeFormProps) => (
    <div className = {props.bridgeLocks.length > 0 ? '' : 'inactive'}>
        <Column>
            <h3>Refund on src network</h3>
            <FormControl >
                <InputLabel id="select-label">Bridge lock: </InputLabel>
                <Select
                    labelId="select-label"
                    id="bridge-lock"
                    value={props.selectedBridgeLockId}
                    label="Bridge Lock"
                    defaultValue={''}
                    onChange={(event) => props.onChangeSelectedRefund(typeof event.target.value === 'string' ? event.target.value : '')}
                >
                    {props.bridgeLocks.filter(bl => bl.open).map((bl, i) => <MenuItem value={bl.id} key={i}>{bl.amount + bl.symbol}</MenuItem>)}
                </Select>
            </FormControl>
            <FormControl>
                <InputLabel id="Secret-label">Secret</InputLabel>
                    <Input
                    id="Secret"
                    value={props.secret}
                    onChange={(event) => props.onSecretChange(typeof event.target.value === 'string' ? event.target.value : '')}
                    />  
            </FormControl>
            <Button 
                disabled={props.selectedBridgeLockId === '' || props.secret === '' || props.fetching} 
                onClick={() => props.onClickRefund()}>
                    Refund
            </Button>
        </Column>
    </div>
)

export default RefundForm;