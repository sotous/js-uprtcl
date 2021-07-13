import { ethers } from 'ethers';
import { HttpAuthentication } from './http.authentication';

export interface Wallet {
    address: string;
    instance: ethers.Wallet | ethers.Signer
}

// Abstraction for HttpEthToken.
export interface HttpEthToken extends HttpAuthentication {
    init(): Promise<Wallet>
}