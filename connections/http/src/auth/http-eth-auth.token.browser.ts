import { ethers } from 'ethers';
import { HttpEthToken, Wallet } from './http-eth-auth.token';
import { AuthTokenStorageImp } from './http.token.store.imp';
import { JwtToken } from './http.authentication';
import { HttpAuthenticatedConnectionImp } from '../http.auth.connection.imp';
import { HttpConnection } from '../http.connection';

export const loginMessage = (nonce: string) => {
  return `Login to Intercreativity \n\nnonce:${nonce}`;
};

export class HttpEthTokenBrowser implements HttpEthToken {
  store: AuthTokenStorageImp;
  connection: HttpConnection;

  constructor(public host) {
    this.store = new AuthTokenStorageImp('ETH_AUTH_TOKEN', 'ETH_USER_ID');
    this.connection = new HttpAuthenticatedConnectionImp(host, this);
  }

  async init(): Promise<Wallet> {
    await window['ethereum'].enable();
    const provider = new ethers.providers.Web3Provider(window['ethereum']);
    const signer = provider.getSigner();
    return {
        address: await signer.getAddress(),
        instance: signer
    };
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
