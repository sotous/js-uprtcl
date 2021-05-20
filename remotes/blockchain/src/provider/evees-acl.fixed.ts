import { html } from 'lit-element';

import { AccessControl, CASStore, Perspective, Signed } from '@uprtcl/evees';
import { Lens } from '@uprtcl/evees-ui';

import { PermissionType } from '@uprtcl/evees-http';

export class EveesAccessControlFixedOwner implements AccessControl {
  store!: CASStore;

  constructor() {}

  setStore(store: CASStore) {
    this.store = store;
  }

  async toggleDelegate(hash: string, delegate: boolean, delegateTo?: string) {

  }

  async setPublicPermissions(hash: string, type: PermissionType, value: Boolean) {
    //await this.connection.put(`/permissions/${hash}/public`, { type, value });
  }

  async getOwner(perspectiveId: string) {
    const perspective = await this.store.getEntity<Signed<Perspective>>(perspectiveId);
    return perspective.object.payload.creatorId;
  }

  async canUpdate(uref: string, userId: string) {
    return userId === (await this.getOwner(uref));
  }

  lense(): Lens {
    return {
      name: 'evees-blockchain:access-control',
      type: 'access-control',
      render: (entity: any) => {
        return html` <evees-permissions-fixed uref=${entity.uref}> </evees-permissions-fixed> `;
      },
    };
  }
}
