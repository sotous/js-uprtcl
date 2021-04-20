import { CASStore } from '../../cas/interfaces/cas-store';

import {
  Update,
  NewPerspective,
  EveesMutation,
  EveesMutationCreate,
  PerspectiveGetResult,
  GetPerspectiveOptions,
  SearchOptions,
  SearchResult,
} from './types';
import { EventEmitter } from 'events';
import { Proposals } from '../proposals/proposals';

export enum ClientEvents {
  updated = 'updated',
  ecosystemUpdated = 'ecosystem-updated',
}

// All evees clients must call the .on('') method with in the following cases
// 'updated': When an perspective head is new.
// 'logged-status-changed': When the logges status has changed.
// 'canUpdate': When the logged user canUpdate status over a perspective changes.

export interface Client {
  readonly store: CASStore;
  readonly events?: EventEmitter;
  readonly proposals?: Proposals;

  /** get a perspective head,
   * include a Slice that can be used by the client to pre-fill the cache */
  getPerspective(
    perspectiveId: string,
    options?: GetPerspectiveOptions
  ): Promise<PerspectiveGetResult>;

  /** create/update perspectives and entities in batch */
  update(mutation: EveesMutationCreate);

  /** convenient methods to edit a single perspective at a time */
  newPerspective(newPerspective: NewPerspective): Promise<void>;
  deletePerspective(perspectiveId: string): Promise<void>;
  updatePerspective(update: Update): Promise<void>;

  /** await for all update transactions received to be processed (visible to read queries) */
  ready?(): Promise<void>;

  /** a custom method that search other perspectives based on the logged user,
   * its kept aside from the searchEngine.otherPerspectives method because we need
   * cache and reactivity of the results this is not possible for the searchEngine.  */
  getUserPerspectives(perspectiveId: string): Promise<string[]>;

  /** returns true if the user can update the perspective */
  canUpdate(perspectiveId: string, userId?: string): Promise<boolean>;

  /** a single endpoint to search the graph of linked perspectives */
  readonly explore?: (
    searchOptions: SearchOptions,
    fetchOptions?: GetPerspectiveOptions
  ) => Promise<SearchResult>;
}
