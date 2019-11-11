import { Connection, ConnectionOptions } from '../../connections/connection';


export interface PostResult {
  result: string;
  message: string;
  elementIds: string[];
}

/**
 * Wrapper over the fetch API
 */
export class HttpConnection extends Connection {
  constructor(protected baseUrl: string, protected authToken: string, options: ConnectionOptions) {
    super(options);
  }

  protected connect(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Builds the headers for the requests
   */
  get headers(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Execute a GET request
   * @param url url to make the request to
   */
  public async get<T>(url: string): Promise<T> {
    this.logger.log('GET: ', url);

    return fetch(this.baseUrl + url, {
      method: 'GET',
      headers: this.headers
    }).then(response => {
      this.logger.log('GET Result: ', url);
      return (response.json() as unknown) as T;
    });
  }

  /**
   * Execute a PUT request
   * @param url url to make the request to
   * @param body body of the request
   */
  public async put(url: string, body: any): Promise<PostResult> {
    return this.putOrPost(url, body, 'PUT');
  }

  /**
   * Execute a POST request
   * @param url url to make the request to
   * @param body body of the request
   */
  public async post(url: string, body: any): Promise<PostResult> {
    return this.putOrPost(url, body, 'POST');
  }

  /**
   * Execute a PUT or POST request
   * @param url url to make the request to
   * @param body body of the request
   * @param method method of the request ('POST' or 'PUT')
   */
  public async putOrPost(url: string, body: any, method: string): Promise<PostResult> {
    this.logger.log('POST: ', url, body, method);
    return fetch(this.baseUrl + url, {
      method: method,
      headers: {
        ...this.headers,
        Accept: 'application/json'
      },
      body: JSON.stringify(body)
    }).then(result => {
      this.logger.log('POST Result: ', result);

      return (result.body as unknown) as PostResult;
    });
  }
}
