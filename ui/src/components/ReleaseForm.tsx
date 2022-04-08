import { FormControl, Input, InputLabel, MenuItem, Select } from "@material-ui/core"
import React from "react"
import Column from "./Column";
import { IBridgeLock } from './RefundForm';
import Button from "./Button"

interface IBridgeFormProps {
    releaseLocks: IBridgeLock[]
    selectedReleaseLockId: string
    releaseAddress: string
    fetching: boolean
    secret: string
    onChangeSelectedRefund: (value: string) => void
    onSecretChange: (value: string) => void
    onClickRelease: () => void
    onChangeReleaseAddress: (value: string) => void
}

const BridgeForm = (props: IBridgeFormProps) => (
    <div className = {props.releaseLocks.length > 0 ? '' : 'inactive'}>
        <Column>
            <h3>Release on target network</h3>
            <FormControl >
                <InputLabel id="select-label">Release lock: </InputLabel>
                <Select
                    labelId="select-label"
                    id="bridge-lock"
                    value={props.selectedReleaseLockId}
                    label="Bridge Lock"
                    defaultValue={''}
                    onChange={(event) => props.onChangeSelectedRefund(typeof event.target.value === 'string' ? event.target.value : '')}
                >
                    {props.releaseLocks.filter(bl => bl.open).map((bl, i) => <MenuItem value={bl.id} key={i}>{bl.amount + bl.symbol}</MenuItem>)}
                </Select>
            </FormControl>
            <FormControl>
                <InputLabel id="address-label">Address</InputLabel>
                    <Input
                    id="address"
                    value={props.releaseAddress}
                    onChange={(event) => props.onChangeReleaseAddress(typeof event.target.value === 'string' ? event.target.value : '')}
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
            <Button 
                disabled={props.selectedReleaseLockId === '' || props.secret === '' || props.fetching} 
                onClick={() => props.onClickRelease()}>
                    Release
            </Button>
        </Column>
    </div>
)

export default BridgeForm;