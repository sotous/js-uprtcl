import { html } from 'lit-element';
import { injectable } from 'inversify';

import { Logger } from '@uprtcl/micro-orchestrator';
import { Pattern, Entity, HasChildren, recognizeEntity } from '@uprtcl/cortex';
import { MergeStrategy, mergeStrings, UprtclAction, Merge, HasDiffLenses, DiffLens } from '@uprtcl/evees';
import { HasLenses, Lens } from '@uprtcl/lenses';
import { NodeActions } from '@uprtcl/evees';

import { Wiki } from '../types';
import { WikiBindings } from '../bindings';

const propertyOrder = ['title', 'pages'];

const logger = new Logger('WIKI-ENTITY');

export class WikiPattern extends Pattern<Wiki> {
  recognize(entity: object): boolean {
    return recognizeEntity(entity) && propertyOrder.every(p => entity.object.hasOwnProperty(p));
  }

  type = WikiBindings.WikiType;
}

@injectable()
export class WikiLinks implements HasChildren<Entity<Wiki>>, Merge<Entity<Wiki>> {
  replaceChildrenLinks = (wiki: Entity<Wiki>) => (childrenHashes: string[]): Entity<Wiki> => ({
    ...wiki,
    object: {
      ...wiki.object,
      pages: childrenHashes
    }
  });

  getChildrenLinks: (wiki: Entity<Wiki>) => string[] = (wiki: Entity<Wiki>): string[] =>
    wiki.object.pages;

  links: (wiki: Entity<Wiki>) => Promise<string[]> = async (wiki: Entity<Wiki>) =>
    this.getChildrenLinks(wiki);

  merge = (originalNode: Entity<Wiki>) => async (
    modifications: Entity<Wiki>[],
    mergeStrategy: MergeStrategy,
    config
  ): Promise<NodeActions<Wiki>> => {
    const resultTitle = mergeStrings(
      originalNode.object.title,
      modifications.map(data => data.object.title)
    );

    // TODO: add entity
    const mergedPages = await mergeStrategy.mergeLinks(
      originalNode.object.pages,
      modifications.map(data => data.object.pages),
      config
    );

    const allActions = ([] as UprtclAction[]).concat(...mergedPages.map(node => node.actions));
    
    return {
      new: {
        pages: mergedPages.map(node => node.new),
        title: resultTitle
      },
      actions: allActions
    };
  };
}

@injectable()
export class WikiCommon implements HasLenses<Entity<Wiki>>, HasDiffLenses<Entity<Wiki>> {
  
  lenses = (wiki: Entity<Wiki>): Lens[] => {
    return [
      {
        name: 'Wiki',
        type: 'content',
        render: (entity: Entity<any>, context: any) => {
          logger.info('lenses() - Wiki', { wiki, context });
          return html`
            <wiki-drawer
              .data=${wiki}
              .ref=${entity.id}
              color=${context.color}
              .selectedPageHash=${context.selectedPageHash}
            >
            </wiki-drawer>
          `;
        }
      }
    ];
  };

  diffLenses = (): DiffLens[] => {
    return [
      {
        name: 'wikis:wiki-diff',
        type: 'diff',
        render: (newEntity: Entity<Wiki>, oldEntity: Entity<Wiki>) => {
          // logger.log('lenses: documents:document - render()', { node, lensContent, context });
          return html`
            <wiki-diff
              .newData=${newEntity}
              .oldData=${oldEntity}>
            </wiki-diff>
          `;
        }
      }
    ];
  };
}
