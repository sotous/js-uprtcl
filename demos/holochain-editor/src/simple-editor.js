import { LitElement, html } from 'lit-element';
import { moduleConnect } from '@uprtcl/micro-orchestrator';
import { DocumentsModule, TextType } from '@uprtcl/documents';
import { EveesModule, EveesHelpers } from '@uprtcl/evees';
import { ApolloClientModule } from '@uprtcl/graphql';

export class SimpleEditor extends moduleConnect(LitElement) {
  static get properties() {
    return {
      rootHash: { type: String }
    };
  }

  subscribeToHistory(history, callback) {
    const pushState = history.pushState;
    history.pushState = function(state) {
      if (typeof history.onpushstate == 'function') {
        history.onpushstate({ state: state });
      }
      callback(arguments);
      // Call your custom function here
      return pushState.apply(history, arguments);
    };
  }

  async firstUpdated() {
    window.addEventListener('popstate', () => {
      this.rootHash = window.location.href.split('id=')[1];
    });

    this.subscribeToHistory(window.history, state => {
      this.rootHash = state[2].split('id=')[1];
    });

    if (window.location.href.includes('?id=')) {
      this.rootHash = window.location.href.split('id=')[1];
    } else {
      const client = this.request(ApolloClientModule.bindings.Client);
      const node = {
        text: 'New Document',
        type: TextType.Paragraph,
        links: []
      };
      const eveesProvider = this.requestAll(EveesModule.bindings.EveesRemote).find(provider =>
        provider.authority.startsWith('holo')
      );

      const dataId = await EveesHelpers.createEntity(client, eveesProvider, node);
      const headId = await EveesHelpers.createCommit(client, eveesProvider, { dataId });
      const randint = 0 + Math.floor((10000 - 0) * Math.random());

      const perspectiveId = await EveesHelpers.createPerspective(client, eveesProvider, {
        headId,
        context: `genesis-dao-wiki-${randint}`
      });

      window.history.pushState('', '', `/?id=${perspectiveId}`);
    }
  }

  render() {
    return html`
      ${this.rootHash
        ? html`
            <documents-editor .ref=${this.rootHash} lens-type="content"></documents-editor>
          `
        : html`
            Loading...
          `}
    `;
  }
}
