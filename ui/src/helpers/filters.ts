import {utils} from 'ethers';

export function bridgeFilter(contractAddress: string) {
    return baseFilter(contractAddress, "CoinBridged(bytes32)")
}

export function releaseFilter(contractAddress: string) {
    return baseFilter(contractAddress, "CoinReleased(bytes32)")
}

export function refundedFilter(contractAddress: string) {
    return baseFilter(contractAddress, "CoinRefunded(bytes32)")
}

function baseFilter(contractAddress: string, id: string) {
    return {
        address: contractAddress,
        topics: [
            utils.id(id)
        ]
    }
}
