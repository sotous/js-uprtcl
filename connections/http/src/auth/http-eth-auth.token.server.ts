import { ethers } from 'ethers';
import { HttpEthToken, Wallet } from './http-eth-auth.token';
import { AuthTokenStorageImp } from './http.token.store.imp';
import { HttpAuthentication, JwtToken } from './http.authentication';
import { HttpAuthenticatedConnectionImp } from '../http.auth.connection.imp';
import { HttpConnection } from '../http.connection';

export const loginMessage = (nonce: string) => {
  return `Login to Intercreativity \n\nnonce:${nonce}`;
};

export class HttpEthTokenServer implements HttpEthToken {
  store: AuthTokenStorageImp;
  connection: HttpConnection;
  mnemonic: string;

  constructor(public host, mnemonic: string) {
    this.mnemonic = mnemonic;
    this.store = new AuthTokenStorageImp('ETH_AUTH_TOKEN', 'ETH_USER_ID');
    this.connection = new HttpAuthenticatedConnectionImp(host, this);
  }

  async init(): Promise<Wallet> {
    const wallet = ethers.Wallet.fromMnemonic(this.mnemonic);
    return {
      address: wallet.address,
      instance: wallet
    }
  }

  async obtainToken(): Promise<JwtToken> {
    const wallet = await this.init();
    const userId = await wallet.address;
    const nonce = await this.connection.get<string>(`/user/${userId}/nonce`);
    const signature = await wallet.instance.signMessage(loginMessage(nonce));
    const result = await this.connection.getWithPut<{ jwt: string }>(`/user/${userId}/authorize`, {
      signature,
    });

    return {
      userId,
      jwt: result.jwt,
    };
  }
}
