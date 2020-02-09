import { LitElement, property, html, css } from 'lit-element';
import { ApolloClient, gql } from 'apollo-boost';
// import { styleMap } from 'lit-html/directives/style-map';
// https://github.com/Polymer/lit-html/issues/729
export const styleMap = style => {
  return Object.entries(style).reduce((styleString, [propName, propValue]) => {
    propName = propName.replace(/([A-Z])/g, matches => `-${matches[0].toLowerCase()}`);
    return `${styleString}${propName}:${propValue};`;
  }, '');
};

import '@material/mwc-drawer';
import '@material/mwc-top-app-bar';
import '@material/mwc-ripple';

import {
  CREATE_COMMIT,
  CREATE_PERSPECTIVE,
  UPDATE_HEAD,
  RemotesConfig,
  EveesModule,
  EveesRemote,
  Secured,
  Perspective,
  Evees
} from '@uprtcl/evees';
import { TextType, CREATE_TEXT_NODE, DocumentsModule, htmlToText } from '@uprtcl/documents';
import { ApolloClientModule } from '@uprtcl/graphql';
import { moduleConnect, Logger } from '@uprtcl/micro-orchestrator';
import { sharedStyles } from '@uprtcl/lenses';

import { Wiki } from '../types';
import { CREATE_WIKI } from '../graphql/queries';
import { Entity, Hashed } from '@uprtcl/cortex';
import { Source } from '@uprtcl/multiplatform';
import { WikisModule } from '../wikis.module';

export class WikiDrawer extends moduleConnect(LitElement) {
  logger = new Logger('WIKI-DRAWER');

  @property({ type: Object })
  wiki: Hashed<Wiki> | undefined = undefined;

  @property({ type: Object })
  perspective: Secured<Perspective> | undefined = undefined;

  @property({ type: String })
  color: string | undefined = undefined;

  @property({ type: Number })
  level: number = 0;

  @property({ type: Boolean, attribute: false })
  editable: Boolean = false;

  @property({ type: String })
  selectedPageHash: string | undefined = undefined;

  @property({ type: Object, attribute: false })
  pagesList: Array<{ title: string; id: string }> | undefined = undefined;

  currentContent: any;
  private currentHeadId: string | undefined = undefined;

  getTextNodeSource(eveesAuthority: string): Source {
    const remotesConfig: RemotesConfig = this.request(EveesModule.bindings.RemotesConfig);

    const textNodeEntity: Entity[] = this.requestAll(DocumentsModule.bindings.TextNodeEntity);
    const name = textNodeEntity[0].name;

    return remotesConfig.map(eveesAuthority, name);
  }

  getWikiSource(eveesAuthority: string): Source {
    const remotesConfig: RemotesConfig = this.request(EveesModule.bindings.RemotesConfig);

    const wikiEntity: Entity[] = this.requestAll(WikisModule.bindings.WikiEntity);
    const name = wikiEntity[0].name;

    return remotesConfig.map(eveesAuthority, name);
  }

  async updateContent(newContent: Wiki): Promise<void> {
    if (!this.perspective) return;

    const client: ApolloClient<any> = this.request(ApolloClientModule.bindings.Client);
    const origin = this.perspective.object.payload.origin;
    const evees: Evees = this.request(EveesModule.bindings.Evees);

    this.logger.info('updateContent() - CREATE_TEXT_NODE', { newContent });
    const createWiki = await client.mutate({
      mutation: CREATE_WIKI,
      variables: {
        content: newContent,
        source: this.getWikiSource(origin).source
      }
    });

    const wikiId = createWiki.data.createWiki.id;

    const commitUpdate = await client.mutate({
      mutation: CREATE_COMMIT,
      variables: {
        parentsIds: this.currentHeadId ? [this.currentHeadId] : [],
        dataId: wikiId,
        source: evees.getPerspectiveProvider(this.perspective.object).source
      }
    });

    const headUpdate = await client.mutate({
      mutation: UPDATE_HEAD,
      variables: {
        perspectiveId: this.perspective.id,
        headId: commitUpdate.data.createCommit.id
      }
    });

    return wikiId;
  }

  async createPage() {
    if (!this.wiki) return;
    if (!this.perspective) return;

    this.pagesList = undefined;

    const origin = this.perspective.object.payload.origin;

    const eveesRemotes: EveesRemote[] = this.requestAll(EveesModule.bindings.EveesRemote);
    const remote = eveesRemotes.find(r => r.authority === origin);

    if (!remote) throw new Error(`Remote not found for authority ${origin}`);

    const pageContent = {
      text: '<h1>New page</h1>',
      type: TextType.Title,
      links: []
    };

    const client: ApolloClient<any> = this.request(ApolloClientModule.bindings.Client);
    const result = await client.mutate({
      mutation: CREATE_TEXT_NODE,
      variables: {
        content: pageContent,
        source: this.getTextNodeSource(origin).source
      }
    });

    const commit = await client.mutate({
      mutation: CREATE_COMMIT,
      variables: {
        dataId: result.data.createTextNode.id,
        parentsIds: [],
        source: remote.source
      }
    });

    const perspective = await client.mutate({
      mutation: CREATE_PERSPECTIVE,
      variables: {
        headId: commit.data.createCommit.id,
        authority: origin
      }
    });

    const newWiki: Wiki = {
      title: this.wiki.object.title,
      pages: [...this.wiki.object.pages, perspective.data.createPerspective.id]
    };

    this.wiki = {
      ...this.wiki,
      object: newWiki
    };

    this.logger.info('createPage()', newWiki);
    await this.updateContent(newWiki);
  }

  updated(changedProperties: any) {
    if (changedProperties.get('wiki') !== undefined) {
      this.loadPagesData();
    }
  }

  async loadPagesData() {
    if (!this.wiki) return;

    const pagesListPromises = this.wiki.object.pages.map(async (pageId) => {
      const client: ApolloClient<any> = this.request(ApolloClientModule.bindings.Client);

      const result = await client.query({
        query: gql`
        {
          entity(id: "${pageId}") {
            id
            _context {
              patterns {
                content {
                  id
                  _context {
                    patterns {
                      title
                    }
                  }
                }
              }
            }
          }
        }`
      });

      return {
        id: pageId,
        title: result.data.entity._context.patterns.content._context.patterns.title
      }
    })

    this.pagesList = await Promise.all(pagesListPromises);
  }

  async firstUpdated() {
    const client: ApolloClient<any> = this.request(ApolloClientModule.bindings.Client);

    const result = await client.query({
      query: gql`
      {
        entity(id: "${this.perspective.id}") {
          id
          _context {
            patterns {
              accessControl {
                canWrite
              }
            }
          }
          ... on Perspective {
            payload {
              origin
            }
            head {
              id
            }
          }
        }
      }`
    });

    this.currentHeadId = result.data.entity.head.id;
    this.editable = result.data.entity._context.patterns.accessControl.canWrite;

    this.loadPagesData();
  }

  selectPage(pageHash: string | undefined) {
    this.dispatchEvent(
      new CustomEvent('page-selected', {
        detail: {
          pageId: pageHash
        }
      })
    );

    this.selectedPageHash = pageHash;
  }

  renderPageList() {
    if (!this.pagesList)
      return html`
        <cortex-loading-placeholder></cortex-loading-placeholder>
      `;

    if (this.pagesList.length === 0)
      return html`
        <div class="empty">
          <span><i>${this.t('wikis:no-pages-yet')}</i></span>
        </div>
      `;

    return html`
      <mwc-list>
        ${this.pagesList.map(page => {
          let text = htmlToText(page.title);
          return html`
            <mwc-list-item @click=${() => this.selectPage(page.id)}>
              ${text}
            </mwc-list-item>
          `;
        })}
      </mwc-list>
    `;
  }

  render() {
    if (!this.wiki)
      return html`
        <cortex-loading-placeholder></cortex-loading-placeholder>
      `;

      return html`
      <mwc-drawer>
        <div class="column">
          <div class="color-bar" style=${styleMap({
            backgroundColor: this.color
          })}></div>
          
          ${this.editable ?
              html`
                <div class="button-row">
                  <mwc-button
                    outlined
                    icon="note_add"
                    @click=${() => this.createPage()}
                  >
                    ${this.t('wikis:new-page')}
                  </mwc-button>
                </div>`: html``}
          <div>
            ${this.renderPageList()}
          </div>
        </div>

        <div slot="appContent" class="fill-content">
          ${this.selectedPageHash
              ? html`
                <wiki-page
                  @nav-back=${() => this.selectPage(undefined)}
                  pageHash=${this.selectedPageHash} 
                  color=${this.color ? this.color : ''}>
                </wiki-page>
              `
              : html`
                <wiki-home 
                  wikiHash=${this.perspective.id} 
                  title=${this.wiki.object.title} 
                  color=${this.color ? this.color : ''}>
                  <slot slot="evee-page" name="evee-page"></slot>
                </wiki-home>
              `}
        </div>
      </mwc-drawer>
    `;
  }

  static get styles() {
    return [sharedStyles,
      css`
        :host {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, 'Apple Color Emoji',
            Arial, sans-serif, 'Segoe UI Emoji', 'Segoe UI Symbol';
          color: #37352f;   
        }
        .evee-info {
          height: 40px;
        }
        .column {
          height: 100%;
        }
        .color-bar {
          height: 1vw;
          width: 100%;
        }
        .empty {
          width: 100%;
          text-align: center; 
          padding-top: 24px; 
          color: #d0d8db;
        }
        .button-row {
          margin: 16px 0px 8px 0px;
          text-align: center;
          width: 100%;
        }
      `];
  }

}
