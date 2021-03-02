import { LitElement, html, css, property } from 'lit-element';
import { icons } from './icons';

export class UprtclExpandable extends LitElement {
  @property({ type: Boolean })
  collapsed: boolean = true;

  render() {
    const classes = ['container'];

    if (this.collapsed) {
      classes.push('collapsed');
    } else {
      classes.push('expanded');
    }

    return html`<div class=${classes.join(' ')}><slot></slot></div>
      <uprtcl-button
        @click=${() => (this.collapsed = !this.collapsed)}
        skinny
        icon=${this.collapsed ? 'double_arrow_black_down' : 'double_arrow_black_up'}
      ></uprtcl-button>`;
  }

  static get styles() {
    return [
      css`
        :host {
          display: flex;
          flex-direction: column;
          width: 100%;
        }
        .container {
        }
        .collapsed {
          max-height: var(--max-height, 200px);
          overflow: hidden;
        }
        .expanded {
        }
        .button {
          display: flex;
          justify-content: center;
          align-items: center;
        }
      `,
    ];
  }
}
