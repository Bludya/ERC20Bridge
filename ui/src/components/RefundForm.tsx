import { FormControl, InputLabel, MenuItem, Select, Input } from "@material-ui/core"
import React from "react"
import Button from "./Button"
import Column from "./Column";

interface IBridgeFormProps {
    bridgeLocks: []
    selectedBridgeLockId: string
    secret: string
    onClickRefund: () => void
    onChangeSelectedRefund: (value: string) => void
    onSecretChange: (value: string) => void
    fetching: boolean
}
  

const RefundForm = (props: IBridgeFormProps) => (
    <div className = {props.bridgeLocks.length > 0 || props.fetching ? '' : 'inactive'}>
        <Column>
            <h4>Refund</h4>
            <FormControl >
                <InputLabel id="select-label">Bridge lock: </InputLabel>
                <Select
                    labelId="select-label"
                    fullWidth 
                    id="bridge-lock"
                    value={props.selectedBridgeLockId}
                    label="Bridge Lock"
                    defaultValue={''}
                    onChange={(event) => props.onChangeSelectedRefund(typeof event.target.value === 'string' ? event.target.value : '')}
                >
                    {props.bridgeLocks.filter((bl: any) => bl.active).map((bl: any, i: number) => <MenuItem value={bl.id} key={i}>{bl.amount + ' ' + bl.symbol}</MenuItem>)}
                </Select>
            </FormControl>
            <FormControl>
                <InputLabel id="secret-label">Secret</InputLabel>
                <Input
                    fullWidth 
                    id="secret-refund"
                    type="password"
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