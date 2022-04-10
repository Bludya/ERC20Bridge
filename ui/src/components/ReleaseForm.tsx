import { FormControl, Input, InputLabel, MenuItem, Select } from "@material-ui/core"
import React from "react"
import Column from "./Column";
import Button from "./Button"

interface IBridgeFormProps {
    releaseLocks: []
    selectedReleaseLockId: string
    fetching: boolean
    secret: string
    onChangeSelectedRelease: (value: string) => void
    onSecretChange: (value: string) => void
    onClickRelease: () => void
}

const BridgeForm = (props: IBridgeFormProps) => (
    <div className = {props.releaseLocks.length > 0 || props.fetching ? '' : 'inactive'}>
        <Column>
            <h4>Release</h4>
            <FormControl >
                <InputLabel id="select-label">Release lock: </InputLabel>
                <Select
                    labelId="select-label"
                    id="bridge-lock"
                    fullWidth 
                    value={props.selectedReleaseLockId}
                    label="Bridge Lock"
                    defaultValue={''}
                    onChange={(event) => props.onChangeSelectedRelease(typeof event.target.value === 'string' ? event.target.value : '')}
                >
                    {props.releaseLocks.filter((bl: any) => bl.active).map((bl: any, i: number) => <MenuItem value={bl.id} key={i}>{bl.amount + ' ' + bl.symbol}</MenuItem>)}
                </Select>
            </FormControl>
            <FormControl>
                <InputLabel id="secret-label">Secret</InputLabel>
                <Input
                    id="secret-release"
                    fullWidth 
                    type="password"
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