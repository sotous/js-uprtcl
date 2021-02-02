import { EventEmitter } from 'events';

import { UpdateRequest, NewPerspectiveData, PerspectiveDetails } from '../interfaces/types';
import { CASStore } from '../../cas/interfaces/cas-store';
import { Entity, ObjectOnRemote } from '../../cas/interfaces/entity';

import {
  Client,
  PerspectiveGetResult,
  EveesMutation,
  EveesMutationCreate,
  ClientEvents,
} from '../interfaces/client';

export class ClientOnMemory implements Client {
  private newPerspectives = new Map<string, NewPerspectiveData>();
  private updates = new Map<string, UpdateRequest>();
  private canUpdates = new Map<string, boolean>();
  private userPerspectives = new Map<string, string[]>();

  private cachedPerspectives = new Map<string, PerspectiveDetails>();

  readonly events: EventEmitter;

  constructor(protected base: Client, public store: CASStore, mutation?: EveesMutation) {
    this.events = new EventEmitter();

    if (mutation) {
      this.update(mutation);
    }
  }

  get searchEngine() {
    return this.base.searchEngine;
  }

  async getPerspective(perspectiveId: string): Promise<PerspectiveGetResult> {
    const cachedPerspective = this.cachedPerspectives.get(perspectiveId);
    if (cachedPerspective) {
      return { details: cachedPerspective };
    }

    const newPerspective = this.newPerspectives.get(perspectiveId);
    if (newPerspective) {
      return {
        details: newPerspective.details,
      };
    }

    const update = this.updates.get(perspectiveId);
    if (update) {
      return {
        details: { headId: update.newHeadId, guardianId: update.guardianId },
      };
    }

    const result = await this.base.getPerspective(perspectiveId);

    /** cache result and slice */
    this.cachedPerspectives.set(perspectiveId, result.details);

    if (result.slice) {
      /** entities are sent to the store to be cached there */
      await this.store.cacheEntities(result.slice.entities);

      result.slice.perspectives.forEach((perspectiveAndDetails) => {
        this.cachedPerspectives.set(perspectiveAndDetails.id, perspectiveAndDetails.details);
      });
    }

    return { details: result.details };
  }
  async createPerspectives(newPerspectives: NewPerspectiveData[]): Promise<void> {
    /** store perspective details */
    await Promise.all(
      newPerspectives.map(async (newPerspective) => {
        await this.store.storeEntity({
          object: newPerspective.perspective.object,
          remote: newPerspective.perspective.object.payload.remote,
        });
        this.newPerspectives.set(newPerspective.perspective.id, newPerspective);
      })
    );
  }

  async updatePerspectives(updates: UpdateRequest[]): Promise<void> {
    updates.forEach((update) => {
      this.updates.set(update.perspectiveId, update);

      /** if perspective head was cached, optimistically update it */
      const cachedDetails = this.cachedPerspectives.get(update.perspectiveId);
      if (cachedDetails) {
        this.cachedPerspectives.set(update.perspectiveId, {
          ...cachedDetails,
          headId: update.newHeadId ? update.newHeadId : cachedDetails.headId,
        });
      }
    });

    this.events.emit(
      ClientEvents.updated,
      updates.map((u) => u.perspectiveId)
    );
  }

  async update(mutation: EveesMutationCreate): Promise<void> {
    const create = mutation.newPerspectives
      ? this.createPerspectives(mutation.newPerspectives)
      : Promise.resolve();
    const update = mutation.updates ? this.updatePerspectives(mutation.updates) : Promise.resolve();
    await Promise.all([create, update]);
  }

  newPerspective(newPerspective: NewPerspectiveData): Promise<void> {
    return this.update({ newPerspectives: [newPerspective] });
  }
  async deletePerspective(perspectiveId: string): Promise<void> {
    await this.update({ deletedPerspectives: [perspectiveId] });
  }
  updatePerspective(update: UpdateRequest): Promise<void> {
    return this.update({ updates: [update] });
  }

  async hashEntities(objects: ObjectOnRemote[]): Promise<Entity<any>[]> {
    return this.store.hashEntities(objects);
  }

  async flush(): Promise<void> {
    await this.store.flush();
    await this.base.update({
      newPerspectives: Array.from(this.newPerspectives.values()),
      updates: Array.from(this.updates.values()),
    });

    this.newPerspectives.clear();
    this.updates.clear();
  }

  async canUpdate(userId: string, perspectiveId: string): Promise<boolean> {
    const canUpdate = this.canUpdates.get(perspectiveId);
    if (canUpdate !== undefined) {
      return canUpdate;
    }

    return this.base.canUpdate(userId, perspectiveId);
  }

  async diff(): Promise<EveesMutation> {
    return {
      newPerspectives: Array.from(this.newPerspectives.values()),
      updates: Array.from(this.updates.values()),
      deletedPerspectives: [],
    };
  }

  /** it gets the logged user perspectives (base layers are user aware) */
  async getUserPerspectives(perspectiveId: string): Promise<string[]> {
    let perspectives = this.userPerspectives.get(perspectiveId);
    if (perspectives === undefined) {
      perspectives = await this.base.getUserPerspectives(perspectiveId);
      this.userPerspectives.set(perspectiveId, perspectives);
    }
    return perspectives;
  }

  refresh(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}