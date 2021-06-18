import { html } from 'lit-element';

import { AccessControl, EntityResolver, Perspective, Signed } from '@uprtcl/evees';
import { Lens } from '@uprtcl/evees-ui';

import { PermissionType } from '@uprtcl/evees-http';

export class EveesAccessControlFixedOwner implements AccessControl {
  entityResolver!: EntityResolver;

  constructor() {}

  setEntityResolver(entityResolver: EntityResolver) {
    this.entityResolver = entityResolver;
  }

  async toggleDelegate(hash: string, delegate: boolean, delegateTo?: string) {

  }

  async setPublicPermissions(hash: string, type: PermissionType, value: Boolean) {
    //await this.connection.put(`/permissions/${hash}/public`, { type, value });
  }

  async getOwner(perspectiveId: string) {
    const perspective = await this.entityResolver.getEntity<Signed<Perspective>>(perspectiveId);
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
