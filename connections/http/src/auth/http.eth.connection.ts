import { HttpAuthenticatedConnectionImp } from '../http.auth.connection.imp';
import { HttpEthToken } from './http-eth-auth.token';

export class HttpEthConnection extends HttpAuthenticatedConnectionImp {
  constructor(host: string, authentication: HttpEthToken) {
    super(host, authentication, 'ETH_AUTH_TOKEN', 'ETH_USER_ID');
  }
}