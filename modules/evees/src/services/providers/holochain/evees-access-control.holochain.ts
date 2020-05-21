import { AccessControlService } from '@uprtcl/access-control';
import { CASSource } from '@uprtcl/multiplatform';
import { Secured } from 'src/utils/cid-hash';
import { Perspective } from 'src/types';
import { PerspectivePattern } from 'src/patterns/perspective.pattern';
import { Signed } from '@uprtcl/cortex';

export interface Creator {
  creatorId: string;
}

export class EveesAccessControlHolochain implements AccessControlService<Creator> {
  constructor(protected source: CASSource) {}
  setPermissions(ref: string, newPersmissions: Creator): Promise<void> {
    throw new Error('Method not implemented.');
  }
  setCanWrite(refs: string, userId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async getPermissions(ref: string): Promise<Creator | undefined> {
    const object: object | undefined = await this.source.get(ref);

    if (!object) return undefined;

    if (!new PerspectivePattern([]).recognize({ id: ref, object })) return undefined;

    const perspective = object as Signed<Perspective>;

    return {
      creatorId: perspective.payload.creatorId
    };
  }
}
