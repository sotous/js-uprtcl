import { EventEmitter } from 'events';

import {
  Update,
  NewPerspective,
  GetPerspectiveOptions,
  PerspectiveGetResult,
  EveesMutation,
  EveesMutationCreate,
} from '../interfaces/types';
import { CASStore } from '../../cas/interfaces/cas-store';
import { Entity, EntityCreate } from '../../cas/interfaces/entity';

import { Client, ClientEvents } from '../interfaces/client';
import { ClientCache } from './client.cache';
import { SearchEngine } from '../interfaces/search.engine';
import { Proposals } from '../proposals/proposals';

export class ClientCachedWithBase implements Client {
  /** A service to subsribe to udpate on perspectives */
  readonly events: EventEmitter;
  searchEngine!: SearchEngine;
  proposals?: Proposals | undefined;

  constructor(
    public store: CASStore,
    protected cache: ClientCache,
    protected base?: Client,
    readonly name: string = 'OnMemoryClient'
  ) {
    this.events = new EventEmitter();
    this.events.setMaxListeners(1000);

    if (this.base && this.base.events) {
      this.base.events.on(ClientEvents.updated, (perspectiveIds: string[]) => {
        /** remove the cached perspectives if updated */
        perspectiveIds.forEach((id) => {
          this.cache.clearCachedPerspective(id);
        });

        this.events.emit(ClientEvents.updated, perspectiveIds);
      });
    }
  }

  async canUpdate(perspectiveId: string, userId?: string): Promise<boolean> {
    if (!userId) {
      const cachedDetails = await this.cache.getCachedPerspective(perspectiveId);
      if (cachedDetails && cachedDetails.details.canUpdate) {
        return cachedDetails.details.canUpdate;
      }
    }

    return true;
  }

  async getPerspective(
    perspectiveId: string,
    options?: GetPerspectiveOptions
  ): Promise<PerspectiveGetResult> {
    const cachedPerspective = await this.cache.getCachedPerspective(perspectiveId);
    if (cachedPerspective) {
      /** skip asking the base client only if we already search for the requested levels under
       * this perspective */
      if (!options || options.levels === undefined || options.levels === cachedPerspective.levels) {
        return { details: { ...cachedPerspective.details } };
      }
    }

    if (!this.base) {
      return { details: {} };
    }

    const result = await this.base.getPerspective(perspectiveId, options);

    /** cache result and slice */
    this.cache.setCachedPerspective(perspectiveId, {
      details: result.details,
      levels: options ? options.levels : undefined,
    });

    if (result.slice) {
      /** entities are sent to the store to be cached there */
      await this.store.cacheEntities(result.slice.entities);

      result.slice.perspectives.forEach((perspectiveAndDetails) => {
        this.cache.setCachedPerspective(perspectiveAndDetails.id, {
          details: perspectiveAndDetails.details,
          levels: options ? options.levels : undefined,
        });
      });
    }

    return { details: result.details };
  }
  async createPerspectives(newPerspectives: NewPerspective[]): Promise<void> {
    /** store perspective details */
    await Promise.all(
      newPerspectives.map(async (newPerspective) => {
        await this.store.storeEntity({
          object: newPerspective.perspective.object,
          remote: newPerspective.perspective.object.payload.remote,
        });
        this.cache.newPerspective(newPerspective);
        /** set the current known details of that perspective, can update is set to true */
        this.cache.setCachedPerspective(newPerspective.perspective.id, {
          details: {
            ...newPerspective.update.details,
            canUpdate: true,
          },
          levels: -1, // new perspectives are assumed to be fully on the cache
        });
      })
    );
  }

  async updatePerspectives(updates: Update[]): Promise<void> {
    await Promise.all(
      updates.map(async (update) => {
        this.cache.addUpdate(update);

        /** update the cache with the new head (keep previous values if update does not
         * specify them)
         * TODO: what if the perpspective is not in the cache? */
        const cachedDetails = (await this.cache.getCachedPerspective(update.perspectiveId)) || {
          details: {},
        };

        if (update.details.headId) {
          cachedDetails.details.headId = update.details.headId;
        }
        if (update.details.guardianId) {
          cachedDetails.details.guardianId = update.details.guardianId;
        }

        await this.cache.setCachedPerspective(update.perspectiveId, cachedDetails);
      })
    );

    this.events.emit(
      ClientEvents.updated,
      updates.map((u) => u.perspectiveId)
    );
  }

  async deletePerspectives(perspectiveIds: string[]): Promise<void> {
    /** store perspective details */
    await Promise.all(
      perspectiveIds.map(async (perspectiveId) => {
        this.cache.deletedPerspective(perspectiveId);
        /** set the current known details of that perspective, can update is set to true */

        this.cache.deleteNewPerspective(perspectiveId);
        this.cache.clearCachedPerspective(perspectiveId);
      })
    );
  }

  async update(mutation: EveesMutationCreate): Promise<void> {
    if (mutation.entities) {
      await this.store.storeEntities(mutation.entities);
    }

    if (mutation.newPerspectives) {
      await this.createPerspectives(mutation.newPerspectives);
    }

    if (mutation.updates) {
      await this.updatePerspectives(mutation.updates);
    }

    if (mutation.deletedPerspectives) {
      await this.deletePerspectives(mutation.deletedPerspectives);
    }
  }

  newPerspective(newPerspective: NewPerspective): Promise<void> {
    return this.update({ newPerspectives: [newPerspective] });
  }
  async deletePerspective(perspectiveId: string): Promise<void> {
    await this.update({ deletedPerspectives: [perspectiveId] });
  }
  updatePerspective(update: Update): Promise<void> {
    return this.update({ updates: [update] });
  }

  async hashEntities(entities: EntityCreate[]): Promise<Entity[]> {
    return this.store.hashEntities(entities);
  }

  async flush(): Promise<void> {
    if (!this.base) {
      throw new Error('base not defined');
    }

    await this.store.flush();

    const newPerspectives = await this.cache.getNewPerspectives();
    const updates = await this.cache.getUpdates();
    const deletedPerspectives = await this.cache.getDeletedPerspective();

    await this.base.update({
      newPerspectives,
      updates,
      deletedPerspectives,
    });

    await this.base.flush();

    await this.clear();
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  /** a mutation with all the changes made relative to the base client */
  async diff(): Promise<EveesMutation> {
    return this.cache.diff();
  }

  /** it gets the logged user perspectives (base layers are user aware) */
  async getUserPerspectives(perspectiveId: string): Promise<string[]> {
    throw new Error('not implemented');
  }

  async refresh(): Promise<void> {}
}
