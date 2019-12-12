import { LitElement, property, html, css } from 'lit-element';
import { ApolloClient, gql } from 'apollo-boost';
import { reduxConnect } from '@uprtcl/micro-orchestrator';
import { Secured, selectCanWrite, PermissionsStatus } from '@uprtcl/common';
import { PatternTypes, PatternRecognizer } from '@uprtcl/cortex';
import { GraphQlTypes } from '@uprtcl/common';

export class WikiPage extends reduxConnect(LitElement) {
  @property({ type: String })
  pageHash!: string;

  @property({ type: String })
  title!: string;

  async firstUpdated() {
    // const client: ApolloClient<any> = this.request(GraphQlTypes.Client);
    // const result = await client.query({
    //   query: gql`{
    //     getEntity(id: "${this.pageHash}") {
    //       content {
    //         entity {
    //           ... on TextNode {
    //             text
    //           }
    //         }
    //       }
    //     }
    //   }`
    // });

    // console.log(result);
  }

  render() {
    return html`
      <cortex-entity .hash=${this.pageHash}> </cortex-entity>
    `;
  }

  static get styles() {
    return css`
      .header {
        display: flex;
        flex-direction: row;
        background-color: #fff;
        height: 4%;
        width: 75%;
        paddint-top:140px;
      }
      .page {
        width: 40%;
        text-align: left;
        border-style: solid;
        border-width: 2px;
        border-left-width: 0px;
      }
    `;
  }
}
