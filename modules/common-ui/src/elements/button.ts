import { LitElement, html, css, property } from 'lit-element';
import { styles } from './styles.css';
import { icons } from './icons';

export class UprtclButton extends LitElement {
  @property({ type: String })
  icon!: string;

  @property({ type: Boolean })
  disabled: boolean = false;

  @property({ type: Boolean })
  outlined: boolean = false;

  @property({ type: Boolean })
  raised: boolean = false;

  render() {
    let classes = ['button-layout', 'button-text'];

    if (this.disabled) {
      classes.push('button-disabled');
    } else {
      if (this.outlined) {
        classes.push('button-outlined', 'cursor');
      } else {
        classes.push('button-filled', 'cursor');
      }

      if (this.raised) {
        classes.push('button-raised', 'cursor');
      }
    }
    return html` <div class=${classes.join(' ')}>
      ${this.icon !== undefined
        ? html`<div class="icon-container">${icons[this.icon]}</div>`
        : ''}

      <slot></slot>
    </div>`;
  }

  static get styles() {
    return [
      styles,
      css`
        .cursor {
          cursor: pointer;
        }
        .button-layout {
          border-radius: 4px;
          display: flex;
          flex-direction: row;
          justify-content: center;
          line-height: 36px;
          height: 36px;
          padding: 0px 16px;
        }
        .icon-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          margin-right: 10px;
        }
      `,
    ];
  }
}
