import { LitElement, property, html, css, query } from 'lit-element';

export class UprtclButtonLoading extends LitElement {
  @property({ type: Boolean })
  loading: boolean = false;

  @property({ type: Boolean })
  outlined: boolean = false;

  @property({ type: Boolean })
  skinny: boolean = false;

  @property({ type: Boolean })
  transition: boolean = false;

  @property({ type: Boolean })
  disabled: boolean = false;

  @property({ type: String })
  icon: string = '';

  render() {
    return html`
      <uprtcl-button
        ?outlined=${this.outlined}
        ?transition=${this.transition}
        ?skinny=${this.skinny}
        ?disabled=${this.disabled}
        icon=${this.loading ? '' : this.icon}
      >
        ${this.loading
          ? html`
              <uprtcl-loading class="loading"></uprtcl-loading>
            `
          : html`
              <slot></slot>
            `}
      </uprtcl-button>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
        width: fit-content;
      }
      .loading {
        --height: 36px;
        --fill: white;
      }
    `;
  }
}
