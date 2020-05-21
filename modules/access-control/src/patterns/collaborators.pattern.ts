import { Pattern } from '@uprtcl/cortex';
import { HasLenses } from '@uprtcl/lenses';
import { injectable } from 'inversify';
import { html } from 'lit-element';
import { Permissions } from '../behaviours/permissions';

export interface Collaborators {
  creatorId: string;
  collaboratorsIds: string;
}


export class CollaboratorPattern extends Pattern<Collaborators> {
  recognize = (entity: any) => {
    return (
      (entity as Collaborators).creatorId !== null &&
      typeof (entity as Collaborators).creatorId === 'string'
    );
  };

  type = 'OwnerPermissions';
}

@injectable()
export class CollaboratorBehaviour implements HasLenses<Collaborators>, Permissions<Collaborators> {
  canWrite = (entity: Collaborators) => (userId: string | undefined): boolean => {
    return !!userId && entity.creatorId === userId;
  };

  lenses = (entity: Collaborators) => [
    {
      name: 'owner-access-control',
      type: 'permissions',
      render: (_, context: any) =>
        html`
          <permissions-owner
            .permissions=${entity}
            .canWrite=${context.canWrite}
            .entityId=${context.entityId}
          ></permissions-owner>
        `,
    },
  ];
}
