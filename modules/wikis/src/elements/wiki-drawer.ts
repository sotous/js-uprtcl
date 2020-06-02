import { property, html, css, LitElement, query } from 'lit-element';
import { ApolloClient, gql } from 'apollo-boost';
const styleMap = (style) => {
  return Object.entries(style).reduce((styleString, [propName, propValue]) => {
    propName = propName.replace(
      /([A-Z])/g,
      (matches) => `-${matches[0].toLowerCase()}`
    );
    return `${styleString}${propName}:${propValue};`;
  }, '');
};

import {
  htmlToText,
  TextType,
  TextNode,
  DocumentsModule,
} from '@uprtcl/documents';
import { Logger, moduleConnect } from '@uprtcl/micro-orchestrator';
import { sharedStyles } from '@uprtcl/lenses';
import {
  Entity,
  HasTitle,
  CortexModule,
  PatternRecognizer,
  Signed,
} from '@uprtcl/cortex';
import {
  MenuConfig,
  EveesRemote,
  EveesModule,
  eveeColor,
  DEFAULT_COLOR,
  RemoteMap,
  EveesHelpers,
  Perspective,
} from '@uprtcl/evees';
import { ApolloClientModule } from '@uprtcl/graphql';
import { CASStore, loadEntity } from '@uprtcl/multiplatform';

import { Wiki } from '../types';

import '@material/mwc-drawer';

import { WikiBindings } from '../bindings';

const LOGINFO = false;
const MAX_LENGTH = 999;

interface PageData {
  id: string;
  title: string;
}

export class WikiDrawer extends moduleConnect(LitElement) {
  logger = new Logger('WIKI-DRAWER');

  @property({ type: String, attribute: 'ref' })
  firstRef!: string;

  @property({ type: String, attribute: 'default-authority' })
  defaultAuthority!: string;

  @property({ type: Array })
  editableAuthorities: string[] = [];

  @property({ type: Boolean, attribute: 'external-routing' })
  externalRouting: boolean = false;

  @property({ attribute: false })
  ref!: string;

  @property({ attribute: false })
  wiki: Entity<Wiki> | undefined;

  @property({ type: Number })
  selectedPageIx: number | undefined = undefined;

  @property({ attribute: false })
  pagesList: PageData[] | undefined = undefined;

  @property({ attribute: false })
  creatingNewPage: boolean = false;

  authority: string = '';
  context: string = '';
  currentHeadId: string | undefined = undefined;
  editable: boolean = false;
  initRef: string = '';
  urlPageId: string = '';

  @property({ attribute: false })
  isDrawerOpened = true;

  @property({ attribute: false })
  isMobile = false;

  @property({ attribute: false })
  documentHasChanges = false;

  @property({ attribute: false })
  isPushing = false;

  @property({ attribute: false })
  drawerType: 'dismissible' | 'modal' = 'dismissible';

  @property({ attribute: false })
  hasSelectedPage = false;

  @property({ attribute: false })
  firstRefAuthor: string = '';

  @property({ attribute: false })
  author: string = '';

  @property({ type: Boolean, attribute: 'show-exit' })
  showExit: boolean = true;

  @property({ attribute: false })
  showEditTitle: boolean = false;

  @property({ attribute: false })
  updatingTitle: boolean = false;

  protected client!: ApolloClient<any>;
  protected eveesRemotes!: EveesRemote[];
  protected recognizer!: PatternRecognizer;
  protected remoteMap!: RemoteMap;

  constructor() {
    super();
    this.isViewportMobile();
    window.addEventListener('resize', this.isViewportMobile.bind(this));
  }

  async firstUpdated() {
    this.client = this.request(ApolloClientModule.bindings.Client);
    this.eveesRemotes = this.requestAll(EveesModule.bindings.EveesRemote);
    this.remoteMap = this.request(EveesModule.bindings.RemoteMap);
    this.recognizer = this.request(CortexModule.bindings.Recognizer);

    this.logger.log('firstUpdated()', { ref: this.ref });

    this.ref = this.firstRef;    

    if(this.externalRouting) {
      this.getUrlParameters()
    }

    this.loadWiki();

    const firstPerspective = await loadEntity<Signed<Perspective>>(
      this.client,
      this.firstRef
    );
    if (firstPerspective) {
      this.firstRefAuthor = firstPerspective.object.payload.creatorId;
    }
  }

  updated(changedProperties) {
    if (changedProperties.has('ref')) {
      if (changedProperties.get('ref') !== undefined) {
        this.loadWiki();
      }
    }

    if (changedProperties.has('firstRef')) {
      this.ref = this.firstRef;
      this.loadWiki();
    }
  }

  getUrlParameters() {
    const pathElements = window.location.pathname.split('/');
    this.initRef = pathElements[3] !== 'official' ? pathElements[3] : '';
    this.urlPageId = pathElements.length > 3 ? pathElements[4] : '';
  }

  color() {
    if (this.firstRef === this.ref) {
      return DEFAULT_COLOR;
    } else {
      return eveeColor(this.ref as string);
    }
  }

  private isViewportMobile() {
    if (window.innerWidth <= 768) {
      if (!this.isMobile) {
        this.drawerType = 'modal';
        this.isDrawerOpened = false;
        this.isMobile = true;
      }
    } else {
      if (this.isMobile) {
        this.drawerType = 'dismissible';
        this.isDrawerOpened = true;
        this.isMobile = false;
      }
    }
  }

  async resetWikiPerspective() {
    // await this.client.resetStore();
    this.pagesList = undefined;
    this.editable = false;
    this.loadWiki();
  }

  async loadWiki() {

    if (this.ref === undefined) return;

    if (this.initRef !== '') this.ref = this.initRef;

    const perspective = (await loadEntity(this.client, this.ref)) as Entity<
      Signed<Perspective>
    >;
    const accessControl = await EveesHelpers.getAccessControl(
      this.client,
      this.ref
    );
    const headId = await EveesHelpers.getPerspectiveHeadId(
      this.client,
      this.ref
    );
    const context = await EveesHelpers.getPerspectiveContext(
      this.client,
      this.ref
    );

    this.authority = perspective.object.payload.authority;
    this.author = perspective.object.payload.creatorId;
    this.currentHeadId = headId;
    this.editable = accessControl
      ? this.editableAuthorities.length > 0
        ? this.editableAuthorities.includes(this.authority)
          ? accessControl.canWrite
          : false
        : accessControl.canWrite
      : false;
    this.context = context;

    this.wiki = await EveesHelpers.getPerspectiveData(this.client, this.ref);

    this.loadPagesData();
    this.requestUpdate();

    // If page is previously selected in the parent component, choose the page
    this.wiki.object.pages.find((id, i) => (id === this.urlPageId ? this.selectPage(i) : false));

    // Clears Page Id and InitRef variables
    this.restoreInitRefAndPageId();
  }

  async loadPagesData() {
    if (!this.wiki) return;

    this.logger.log('loadPagesData()');

    const pagesListPromises = this.wiki.object.pages.map(
      async (pageId): Promise<PageData> => {
        const data = await EveesHelpers.getPerspectiveData(this.client, pageId);
        const hasTitle: HasTitle = this.recognizer
          .recognizeBehaviours(data)
          .find((b) => (b as HasTitle).title);

        const title = hasTitle.title(data);

        return {
          id: pageId,
          title,
        };
      }
    );

    this.pagesList = await Promise.all(pagesListPromises);
    this.logger.log('loadPagesData()', { pagesList: this.pagesList });
  }

  goToPage(ix: number | undefined, id: string | undefined) {
    if(this.externalRouting) {  
      this.emitExternalRoutingEvent('select-page', {
        official: this.ref === this.firstRef,
        perspective: this.ref,
        rootPerspective: this.firstRef,
        pageId: id
      })
      return;
    } else {
      this.selectPage(ix)
    }
  }

  selectPage(ix: number | undefined) {
    if (!this.wiki) return;
    this.selectedPageIx = ix;

    if (this.selectedPageIx === undefined) {
      this.hasSelectedPage = false;
      return;
    }    

    this.dispatchEvent(
      new CustomEvent('page-selected', {
        detail: {
          pageId: this.wiki.object.pages[this.selectedPageIx],
        },
      })
    );
    this.hasSelectedPage = true;
    if (this.isMobile) {
      this.isDrawerOpened = false;
    }
  }

  getStore(authority: string, type: string): CASStore | undefined {
    const remote = this.eveesRemotes.find((r) => r.authority === authority);
    if (!remote) throw new Error(`Remote not found for authority ${authority}`);
    return this.remoteMap(remote);
  }

  async createPage(page: TextNode, authority: string) {
    if (!this.eveesRemotes) throw new Error('eveesRemotes undefined');
    if (!this.client) throw new Error('client undefined');

    const remote = this.eveesRemotes.find((r) => r.authority === authority);
    if (!remote) throw new Error(`Remote not found for authority ${authority}`);

    const store = this.getStore(
      authority,
      DocumentsModule.bindings.TextNodeType
    );
    if (!store) throw new Error('store is undefined');

    const dataId = await EveesHelpers.createEntity(this.client, store, page);
    const headId = await EveesHelpers.createCommit(this.client, remote, {
      dataId,
      parentsIds: [],
    });
    return EveesHelpers.createPerspective(this.client, remote, {
      headId,
      context: `${this.context}_${Date.now()}`,
      parentId: this.ref,
    });
  }

  async updateContent(newWiki: Wiki) {
    const store = this.getStore(this.authority, WikiBindings.WikiType);
    if (!store) throw new Error('store is undefined');

    const remote = this.eveesRemotes.find(
      (r) => r.authority === this.authority
    );
    if (!remote)
      throw Error(`Remote not found for authority ${this.authority}`);

    const dataId = await EveesHelpers.createEntity(this.client, store, newWiki);
    const headId = await EveesHelpers.createCommit(this.client, remote, {
      dataId,
      parentsIds: [this.currentHeadId ? this.currentHeadId : ''],
    });
    await EveesHelpers.updateHead(this.client, this.ref, headId);

    this.logger.info('updateContent()', newWiki);

    this.loadWiki();
  }

  async splicePages(pages: any[], index: number, count: number) {
    if (!this.wiki) throw new Error('wiki undefined');

    const getPages = pages.map((page) => {
      if (typeof page !== 'string') {
        return this.createPage(page, this.authority);
      } else {
        return Promise.resolve(page);
      }
    });

    const pagesIds = await Promise.all(getPages);

    const newObject = { ...this.wiki.object };
    const removed = newObject.pages.splice(index, count, ...pagesIds);

    return {
      entity: newObject,
      removed,
    };
  }

  async newPage(index?: number) {
    if (!this.wiki) return;
    this.creatingNewPage = true;

    const newPage: TextNode = {
      text: '',
      type: TextType.Title,
      links: [],
    };

    index = index === undefined ? this.wiki.object.pages.length : index;

    const result = await this.splicePages([newPage], index, 0);
    if (!result.entity) throw Error('problem with splice pages');

    await this.updateContent(result.entity);

    this.selectPage(index);

    this.creatingNewPage = false;
  }

  async movePage(fromIndex: number, toIndex: number) {
    const { removed } = await this.splicePages([], fromIndex, 1);
    const { entity } = await this.splicePages(removed as string[], toIndex, 0);

    await this.updateContent(entity);

    if (this.selectedPageIx === undefined) return;

    /** this page was moved */
    if (fromIndex === this.selectedPageIx) {
      this.selectPage(toIndex);
    } else {
      /** a non selected page was moved to the selected index */
      if (toIndex === this.selectedPageIx) {
        this.selectPage(fromIndex);
      }
    }
  }

  async removePage(pageIndex: number) {
    const { entity } = await this.splicePages([], pageIndex, 1);
    await this.updateContent(entity);

    if (this.selectedPageIx === undefined) return;

    /** this page was removed */
    if (pageIndex === this.selectedPageIx) {
      this.selectPage(undefined);
    }

    /** a younger page was removed */
    if (pageIndex < this.selectedPageIx) {
      this.selectedPageIx = this.selectedPageIx - 1;
    }
  }

  async optionOnPage(pageIndex: number, option: string) {
    switch (option) {
      case 'move-up':
        this.movePage(pageIndex, pageIndex - 1);
        break;

      case 'move-down':
        this.movePage(pageIndex, pageIndex + 1);
        break;

      case 'remove':
        this.removePage(pageIndex);
        break;
    }
  }

  titleOptionClicked(e: CustomEvent) {
    switch (e.detail.key) {
      case 'edit-title':
        this.showEditTitle = true;
        break;
    }
  }

  async editTitle(newTitle: string) {
    this.updatingTitle = true;
    if (!this.wiki) throw new Error('wiki undefined');
    const wiki = this.wiki.object;

    wiki.title = newTitle;

    await this.updateContent(wiki);

    this.updatingTitle = false;
    this.showEditTitle = false;
  }

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener('checkout-perspective', ((event: CustomEvent) => {

      const { detail: { perspectiveId } } = event;

      if(this.externalRouting) {
        this.emitExternalRoutingEvent('select-perspective', {
          rootPerspective: this.firstRef,
          perspective: perspectiveId
        })
      } else {
        this.ref = perspectiveId;
        this.resetWikiPerspective();
      }
    }) as EventListener);
  }

  renderPageList() {
    if (this.pagesList === undefined)
      return html`
        <cortex-loading-placeholder
          class="empty-pages-loader"
        ></cortex-loading-placeholder>
      `;

    if (this.pagesList.length === 0)
      return html`
        <div class="empty">
          <span><i>${this.t('wikis:no-pages-yet')}</i></span>
        </div>
      `;

    return html`
      <mwc-list>
        ${this.pagesList.map((page, ix) => {
          // this.logger.log(`rendering page title ${page.id}`, menuConfig);
          return this.renderPageItem(page, ix);
        })}
      </mwc-list>
    `;
  }

  renderPageItem(page: PageData, ix: number) {
    const menuConfig: MenuConfig = {
      'move-up': {
        disabled: ix === 0,
        text: 'move up',
        graphic: 'arrow_upward',
      },
      'move-down': {
        disabled: ix === (this.pagesList as any[]).length - 1,
        text: 'move down',
        graphic: 'arrow_downward',
      },
      remove: {
        disabled: false,
        text: 'remove',
        graphic: 'clear',
      },
    };

    const text = htmlToText(page.title);
    const empty = text === '';
    const selected = this.selectedPageIx === ix;

    let classes: string[] = [];

    classes.push('page-item');
    if (empty) classes.push('title-empty');
    if (selected) classes.push('title-selected');

    return html`
      <div class=${classes.join(' ')} @click=${() => this.goToPage(ix, page.id)}>
        <div class="text-container">
          ${text.length < MAX_LENGTH ? text : `${text.slice(0, MAX_LENGTH)}...`}
        </div>
        ${this.editable
          ? html`
              <evees-options-menu
                @option-click=${(e) => this.optionOnPage(ix, e.detail.key)}
                .config=${menuConfig}
              >
              </evees-options-menu>
            `
          : ''}
      </div>
    `;
  }

  renderColorBar() {
    return html`
      <div
        class="color-bar"
        style=${styleMap({
          backgroundColor: this.color(),
        })}
      ></div>
    `;
  }

  renderPushButton() {
    return html`
      <section style="display:flex; align-items:center;">
        <div class="button-container">
          <evees-loading-button
            @click=${() => this.triggerDocumentPush()}
            icon="unarchive"
            loading=${this.isPushing}
            label="push"
          >
          </evees-loading-button>
        </div>
        <evees-help>
          <span>
            Changes are saved locally on this device until you "push" them.<br /><br />
            Once pushed they will be visible (if this perspective is public).<br /><br />
            Only pushed changes are included on merge proposals.
          </span>
        </evees-help>
      </section>
    `;
  }

  renderNavBar() {
    return html`<section>
      <div class="nav-bar-top">
        ${this.showExit
          ? html`<mwc-button
              icon="arrow_back"
              label="exit"
              @click=${() => this.goBack()}
            ></mwc-button>`
          : ''}
        <mwc-button
          ?unelevated=${this.ref === this.firstRef}
          label="official"
          @click=${() => this.goToOfficial()}
        ></mwc-button>
        <div class="perspective-author-wrapper">
          ${this.ref !== this.firstRef
            ? html`<evees-author
                user-id=${this.author}
                show-name="false"
                color=${eveeColor(this.ref)}
                @click=${() => this.goToHome()}
              ></evees-author>`
            : ''}
        </div>
      </div>
      <div>
        ${this.renderPageList()}
      </div>

      ${this.editable
        ? html`
            <div class="button-row">
              <evees-loading-button
                icon="add_circle_outline"
                @click=${() => this.newPage()}
                loading=${this.creatingNewPage ? 'true' : 'false'}
                label=${this.t('wikis:new-page')}
              >
              </evees-loading-button>
            </div>
          `
        : html``}
    </section>`;
  }

  renderWikiTitle() {
    const contextConfig: MenuConfig = {};

    contextConfig['edit-title'] = {
      disabled: false,
      graphic: 'edit',
      text: 'edit',
    };

    return html`<div class="title-card-container">
      <div class="section">
        <div class="section-header">
          ${this.wiki ? this.wiki.object.title : ''}
        </div>

        <div class="section-content">
          <div class="row center-aligned">
            ${this.ref === this.firstRef
              ? html`<div class="official-name">(Official)</div>`
              : html`<span class="by-3box">by</span>
                  <evees-author user-id=${this.author}></evees-author>`}
          </div>
          <div class="row center-aligned title-form">
            ${this.showEditTitle
              ? html`<evees-string-form
                  value=${this.wiki ? this.wiki.object.title : ''}
                  label="new title"
                  @cancel=${() => (this.showEditTitle = false)}
                  @accept=${(e) => this.editTitle(e.detail.value)}
                  ?loading=${this.updatingTitle}
                ></evees-string-form>`
              : ''}
          </div>
        </div>

        <div class="context-menu">
          <evees-help>
            <span>
              This Wiki is multi-perspective. <br /><br />It has one "official"
              perspective, and many different "personal" perspectives.<br /><br />
              The owner of the official perspective is shown below, under
              "Access Control".
            </span>
          </evees-help>
          ${this.editable
            ? html`<evees-options-menu
                .config=${contextConfig}
                @option-click=${this.titleOptionClicked}
              ></evees-options-menu>`
            : ''}
        </div>
      </div>
    </div>`;
  }

  render() {
    this.logger.log('render()', {
      wiki: this.wiki,
      ref: this.ref,
      editable: this.editable,
    });
    if (!this.wiki || !this.ref)
      return html` <cortex-loading-placeholder></cortex-loading-placeholder> `;

    return html`
      <mwc-drawer
        @MDCDrawer:closed=${() => (this.isDrawerOpened = false)}
        type="${this.drawerType}"
        ?open="${this.isDrawerOpened}"
      >
        ${this.renderColorBar()} ${this.renderNavBar()}

        <div slot="appContent" class="app-content">
          ${this.isMobile
            ? html`
                <div class="app-top-nav">
                  <mwc-icon-button
                    slot="navigationIcon"
                    icon="menu"
                    @click=${() => this.toggleNav()}
                  ></mwc-icon-button>

                  ${this.documentHasChanges ? this.renderPushButton() : ''}
                </div>
              `
            : ''}
          ${this.renderColorBar()}
          ${this.selectedPageIx !== undefined
            ? html`
                <wiki-page
                  id="wiki-page"
                  @nav-back=${() => this.goToPage(undefined, '')}
                  @page-title-changed=${() => this.loadPagesData()}
                  pageHash=${this.wiki.object.pages[this.selectedPageIx]}
                  color=${this.color() ? this.color() : ''}
                  @doc-changed=${(e) => this.onDocChanged(e)}
                  .editableAuthorities=${this.editableAuthorities}
                >
                </wiki-page>
              `
            : html`
                <div class="home-container">
                  ${this.renderWikiTitle()}

                  <div class="evee-info">
                    <evees-info-page
                      slot="evee-page"
                      first-perspective-id=${this.firstRef as string}
                      perspective-id=${this.ref}
                      evee-color=${this.color()}
                      default-authority=${this.defaultAuthority as string}
                    ></evees-info-page>
                  </div>
                </div>
              `}
        </div>
      </mwc-drawer>
    `;
  }

  onDocChanged(e: CustomEvent) {
    const hasChanges = e.detail.docChanged || false;
    console.log({ hasChanges });
    // console.log({ v: e.detail });
    this.documentHasChanges = hasChanges;
  }

  toggleNav() {
    this.isDrawerOpened = !this.isDrawerOpened;
  }

  async triggerDocumentPush() {
    if (this.shadowRoot && !this.isPushing) {
      this.isPushing = true;
      const el: any = this.shadowRoot.getElementById('wiki-page');
      await el.pushDocument().finally(() => {
        this.isPushing = false;
      });
    }
  }

  goToOfficial() {
    if(this.externalRouting) {
      this.emitExternalRoutingEvent('select-perspective', {
        rootPerspective: this.firstRef
      })
    } else {
      this.ref = this.firstRef;
      if (this.isMobile) {
        this.isDrawerOpened = false;
      }
      this.goToHome();
    }
  }

  goToHome() {
    this.selectPage(undefined);
    if (this.isMobile) {
      this.isDrawerOpened = false;
    }
  }

  goBack() {
    this.dispatchEvent(
      new CustomEvent('back', { bubbles: true, composed: true })
    );
  }

  emitExternalRoutingEvent(eventName: string, eventDetails: object) {
    this.dispatchEvent(
      new CustomEvent(eventName, { bubbles: true, composed: true, detail: eventDetails })
    );
  }

  restoreInitRefAndPageId() {
    this.initRef = '';
    this.urlPageId = '';
  }

  static get styles() {
    return [
      sharedStyles,
      css`
        :host {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica,
            'Apple Color Emoji', Arial, sans-serif, 'Segoe UI Emoji',
            'Segoe UI Symbol';
          color: #37352f;
          --mdc-theme-primary: #2196f3;
          width: 100%;
        }
        .evee-info {
          height: 40px;
        }
        .column {
          height: 100%;
        }
        .color-bar {
          height: 1vw;
          max-height: 5px;
          flex-shrink: 0;
          width: 100%;
        }
        .nav-bar-top {
          display: flex;
          padding: 14px 10px 0px 0px;
          width: calc(100% - 10px);
          justify-content: space-between;
          border-color: #a2a8aa;
          border-bottom-style: solid;
          border-bottom-width: 1px;
        }
        .nav-bar-top .slash {
          font-size: 28px;
          margin-right: 6px;
        }
        .perspective-author-wrapper {
          width: 48px;
          height: 48px;
        }
        .nav-bar-top evees-author {
          cursor: pointer;
        }
        .empty-pages-loader {
          margin-top: 22px;
          display: block;
        }
        .page-item {
          min-height: 48px;
          cursor: pointer;
          width: calc(100% - 19px);
          display: flex;
          padding: 0px 3px 0px 16px;
          transition: all 0.1s ease-in;
        }
        .page-item .text-container {
          max-width: calc(100% - 48px);
          overflow-x: hidden;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .page-item:hover {
          background-color: #e8ecec;
        }
        .title-empty {
          color: #a2a8aa;
          font-style: italic;
        }
        .title-selected {
          font-weight: bold;
          background-color: rgb(200, 200, 200, 0.2);
        }
        .empty {
          width: 100%;
          text-align: center;
          padding-top: 24px;
          color: #a2a8aa;
        }
        .center-aligned {
          justify-content: center;
          align-items: center;
        }
        .button-row {
          width: calc(100% - 20px);
          padding: 16px 10px 8px 10px;
          display: flex;
        }
        .button-row evees-loading-button {
          margin: 0 auto;
        }
        .app-top-nav {
          padding: 5px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        mwc-drawer {
          min-width: 800px;
          position: relative;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
        }

        .app-content {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .home-container {
          text-align: center;
          height: auto;
          min-height: 100%;
          padding: 3vw 0px;
        }

        .title-card-container {
          padding: 0px 5vw;
        }

        .section {
          text-align: center;
          width: 100%;
          max-width: 700px;
          margin: 0 auto;
          box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.2);
          margin-bottom: 36px;
          border-radius: 4px;
          background-color: rgb(255, 255, 255, 0.6);
          position: relative;
        }
        .section-header {
          font-weight: bold;
          padding: 2vw 0px 0.8vw 0px;
          font-size: 1.6em;
          border-style: solid 2px;
        }
        .section-content evees-author {
          display: inline-block;
          margin-left: 12px;
        }
        .section-content {
          padding-bottom: 2vw;
        }
        .official-name {
          font-size: 1.6em;
          font-weight: bold;
          color: #4e585c;
          font-size: 1.3em;
        }
        .by-3box {
          color: rgb(99, 102, 104);
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.015em;
          font-size: 1.1em;
        }
        .context-menu {
          position: absolute;
          top: 6px;
          right: 6px;
          display: flex;
        }
        .title-form {
          margin-top: 22px;
        }

        @media (max-width: 768px) {
          mwc-drawer {
            min-width: initial;
          }
          .app-content {
            min-width: 100% !important;
          }
        }
      `,
    ];
  }
}
