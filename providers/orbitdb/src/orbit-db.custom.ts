import { Observable } from 'rxjs';

import OrbitDB from 'orbit-db';
import IPFS from 'ipfs';

import OrbitDBSet from '@tabcat/orbit-db-set';
import { IdentityProvider, Keystore } from '@tabcat/orbit-db-identity-provider-d';

import { Logger } from '@uprtcl/micro-orchestrator';
import { Connection, ConnectionOptions } from '@uprtcl/multiplatform';

import { EntropyGenerator } from './entropy.generator';
import { CustomStore } from './types';

OrbitDB.addDatabaseType(OrbitDBSet.type, OrbitDBSet);
OrbitDB.Identities.addIdentityProvider(IdentityProvider);

const keystorePath = id => `./orbitdb/identity/odbipd-${id}`;

interface Status {
  pinnerHttpConnected: boolean;
  pinnerPeerConnected: boolean;
  logged: boolean;
}

export class OrbitDBCustom extends Connection {
  public instance: any;
  private storeQueue = {};
  public identity: null | any = null;
  readonly status: Status = {
    pinnerHttpConnected: false,
    pinnerPeerConnected: false,
    logged: false
  };

  logger = new Logger('OrbitDB-Connection');

  constructor(
    protected storeManifests: CustomStore[],
    protected acls: any[],
    protected entropy: EntropyGenerator,
    protected pinnerUrl?: string,
    protected pinnerMultiaddr?: string,
    public ipfs?: any,
    options?: ConnectionOptions
  ) {
    super(options);

    /** register AccessControllers */
    this.acls.map(AccessController => {
      if (!OrbitDB.AccessControllers.isSupported(AccessController.type)) {
        OrbitDB.AccessControllers.addAccessController({ AccessController });
      }
    });
  }

  /**
   * @override
   */
  public async connect(params: any): Promise<void> {
    this.logger.log('Connecting');

    if (!this.ipfs) {
      this.ipfs = await IPFS.create(params);
    }

    this.instance = await OrbitDB.createInstance(this.ipfs);
    this.identity = this.instance.identity;

    // TODO: set status when peer connected is pinner address

    this.logger.log('Connected', {
      instance: this.instance,
      identity: this.identity
    });
  }

  public async login() {
    const privateKey = await this.entropy.get();
    const identity = await this.deriveIdentity(privateKey);
    this.useIdentity(identity);
    this.status.logged = true;
  }

  public async logout() {
    this.useIdentity(this.instance.identity);
    this.status.logged = false;
  }

  public isLogged() {
    return this.status.logged;
  }

  public async deriveIdentity(sig: string): Promise<any> {
    const id = sig.slice(-8);
    return OrbitDB.Identities.createIdentity({
      keystore: new Keystore(keystorePath(id)),
      type: IdentityProvider.type,
      id: id,
      derive: sig
    });
  }

  public useIdentity(identity: any): void {
    this.identity = identity;
  }

  public getManifest(type: string) {
    return this.storeManifests.find(s => s.customType === type);
  }

  public async storeAddress(type: string, entity: any): Promise<string> {
    const storeManifest = this.getManifest(type);
    if (storeManifest === undefined) throw new Error(`store if type ${type} not found`);

    return this.instance.determineAddress(
      storeManifest.name(entity),
      storeManifest.type,
      storeManifest.options(entity)
    );
  }

  private async openStore(address: string | any): Promise<any> {
    // this.logger.log(`${address} -- Openning store`);
    let db;

    const hadDB = await this.instance._haveLocalData(this.instance.cache, address);

    if (this.instance.stores[address]) {
      // this.logger.log(`${address} -- Store loaded. HadDB: ${hadDB}`);
      db = this.instance.stores[address];
    } else if (this.storeQueue[address]) {
      // this.logger.log(`${address} -- Store already queue. HadDB: ${hadDB}`);
      db = this.storeQueue[address];
    }
    else {
      this.logger.log(`${address} -- Store init - first time. HadDB: ${hadDB}`);
      db = this.storeQueue[address] = this.instance
        .open(address, { identity: this.identity })
        .then(async store => {
          await store.load();
          return store;
        })
        .finally(() => delete this.storeQueue[address]);
    }

    db = await db;

    if (db.identity.id !== this.identity.id) db.setIdentity(this.identity);
    this.logger.log(`${db.address} -- Opened. HadDB: ${hadDB}`);

    const result = await fetch(`${this.pinnerUrl}/includes?address=${address}`, {
      method: 'GET'
    });

    const { includes } = await result.json()

    if (!hadDB && includes) {
      this.logger.log(`${db.address} -- Awaiting replication. HadDB: ${hadDB}`);
      await new Promise((resolve) => {
        db.events.on('replicated', async (r) => {
          this.logger.log(`${r} -- Replicated`);
          resolve()
        })
        db.events.on('peer', (p) => {
          this.logger.log(`${p} -- Peer`);
        })
      });
    }

    return db;
  }

  public async getStore(type: string, entity?: any, pin: boolean = false): Promise<any> {
    const address = await this.storeAddress(type, entity);
    const store = this.openStore(address);
    if (pin) {
      this.pin(address);
    }
    return store;
  }

  public async pin(address: string) {
    if (this.pinnerUrl) {
      fetch(`${this.pinnerUrl}/pin?address=${address}`, {
        method: 'GET'
      }).then(response => {
        console.log(response);
      });
    }
  }
}
