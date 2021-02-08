import { HasChildren } from '../../patterns/behaviours/has-links';
import { SimpleMergeStrategy } from './simple.merge-strategy';
import { Evees } from '../evees.service';

export class RecursiveContextMergeStrategy extends SimpleMergeStrategy {
  perspectivesByContext:
    | Map<
        string,
        {
          to: string | undefined;
          from: string | undefined;
        }
      >
    | undefined = undefined;

  allPerspectives: Map<string, string> | undefined = undefined;

  async isPattern(id: string, type: string): Promise<boolean> {
    const entity = await this.evees.client.store.getEntity(id);
    if (entity === undefined) throw new Error('entity not found');
    const recongnizedType = this.evees.recognizer.recognizeType(entity.object);
    return type === recongnizedType;
  }

  setPerspective(perspectiveId: string, context: string, to: boolean): void {
    if (!this.perspectivesByContext) throw new Error('perspectivesByContext undefined');
    if (!this.allPerspectives) throw new Error('allPerspectives undefined');

    if (!this.perspectivesByContext[context]) {
      this.perspectivesByContext[context] = {
        to: undefined,
        from: undefined,
      };
    }

    if (to) {
      this.perspectivesByContext[context].to = perspectiveId;
    } else {
      this.perspectivesByContext[context].from = perspectiveId;
    }

    this.allPerspectives[perspectiveId] = context;
  }

  async readPerspective(perspectiveId: string, to: boolean): Promise<void> {
    const context = await this.evees.getPerspectiveContext(perspectiveId);
    this.setPerspective(perspectiveId, context, to);

    const { details } = await this.evees.client.getPerspective(perspectiveId);

    if (details.headId == null) {
      return;
    }

    /** read children recursively */
    const data = await this.evees.getPerspectiveData(perspectiveId);
    const children = this.evees.behavior(data.object, 'children');

    const promises = children.map(async (child) => {
      const isPerspective = await this.isPattern(child, 'Perspective');
      if (isPerspective) {
        this.readPerspective(child, to);
      } else {
        Promise.resolve();
      }
    });

    await Promise.all(promises);
  }

  async readAllSubcontexts(toPerspectiveId: string, fromPerspectiveId: string): Promise<void> {
    const promises = [
      this.readPerspective(toPerspectiveId, true),
      this.readPerspective(fromPerspectiveId, false),
    ];

    await Promise.all(promises);
  }

  async mergePerspectivesExternal(toPerspectiveId: string, fromPerspectiveId: string, config: any) {
    /** reset internal state */
    this.perspectivesByContext = undefined;
    this.allPerspectives = undefined;

    return this.mergePerspectives(toPerspectiveId, fromPerspectiveId, config);
  }

  async mergePerspectives(
    toPerspectiveId: string,
    fromPerspectiveId: string,
    config: any
  ): Promise<string> {
    let root = false;
    if (!this.perspectivesByContext) {
      root = true;
      this.perspectivesByContext = new Map();
      this.allPerspectives = new Map();
      await this.readAllSubcontexts(toPerspectiveId, fromPerspectiveId);
    }

    return super.mergePerspectives(toPerspectiveId, fromPerspectiveId, config);
  }

  private async getPerspectiveContext(perspectiveId: string): Promise<string> {
    if (!this.allPerspectives) throw new Error('allPerspectives undefined');

    if (this.allPerspectives[perspectiveId]) {
      return this.allPerspectives[perspectiveId];
    } else {
      const secured = await this.evees.client.store.getEntity(perspectiveId);
      if (!secured) throw new Error(`perspective ${perspectiveId} not found`);
      return secured.object.payload.context;
    }
  }

  async getLinkMergeId(link: string) {
    const isPerspective = await this.isPattern(link, 'Perspective');
    if (isPerspective) {
      return this.getPerspectiveContext(link);
    } else {
      return Promise.resolve(link);
    }
  }

  async mergeLinks(
    originalLinks: string[],
    modificationsLinks: string[][],
    config: any
  ): Promise<string[]> {
    if (!this.perspectivesByContext) throw new Error('perspectivesByContext undefined');

    /** The context is used as Merge ID for perspective to have a context-based merge. For other
     * type of entities, like commits or data, the link itself is used as mergeId */
    const originalPromises = originalLinks.map((link) => this.getLinkMergeId(link));
    const modificationsPromises = modificationsLinks.map((links) =>
      links.map((link) => this.getLinkMergeId(link))
    );

    const originalMergeIds = await Promise.all(originalPromises);
    const modificationsMergeIds = await Promise.all(
      modificationsPromises.map((promises) => Promise.all(promises))
    );

    const mergedLinks = await super.mergeLinks(originalMergeIds, modificationsMergeIds, config);

    const dictionary = this.perspectivesByContext;

    const mergeLinks = mergedLinks.map(
      async (link): Promise<string> => {
        const perspectivesByContext = dictionary[link];

        if (perspectivesByContext) {
          const needsSubperspectiveMerge = perspectivesByContext.to && perspectivesByContext.from;

          if (needsSubperspectiveMerge) {
            /** Two perspectives of the same context are merged, keeping the "to" perspecive id,
             *  and updating its head (here is where recursion start) */

            config = {
              parentId: perspectivesByContext.to,
              ...config,
            };

            await this.mergePerspectives(
              perspectivesByContext.to as string,
              perspectivesByContext.from as string,
              config
            );

            return perspectivesByContext.to as string;
          } else {
            if (perspectivesByContext.to) {
              /** if the perspective is only present in the "to", just keep it */
              return perspectivesByContext.to;
            } else {
              /** otherwise, if merge config.forceOwner and this perspective is only present in the
               * "from", a fork will be created using parentId as the source for permissions*/
              if (config.forceOwner) {
                const toRemote = await this.evees.getPerspectiveRemote(perspectivesByContext.to);
                const newPerspectiveId = await this.evees.forkPerspective(
                  perspectivesByContext.from as string,
                  toRemote.id,
                  config.parentId
                );
                return newPerspectiveId;
              } else {
                return perspectivesByContext.from as string;
              }
            }
          }
        } else {
          return link;
        }
      }
    );

    const mergeResults = await Promise.all(mergeLinks);

    return mergeResults;
  }
}
