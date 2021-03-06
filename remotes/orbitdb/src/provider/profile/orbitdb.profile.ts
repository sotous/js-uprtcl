import { LitElement, property, html, css, query } from 'lit-element';
// import * as ENS from 'ethereum-ens';
import { blockies } from './blockies.js.js';

const styleMap = (style) => {
  return Object.entries(style).reduce((styleString, [propName, propValue]) => {
    propName = propName.replace(/([A-Z])/g, (matches) => `-${matches[0].toLowerCase()}`);
    return `${styleString}${propName}:${propValue};`;
  }, '');
};

export class OrbitDBProfile extends moduleConnect(LitElement) {
  logger = new Logger('ORBITDB-PROFILE');

  @property({ type: String })
  address!: string;

  @property({ type: Boolean, attribute: 'show-name' })
  showName = false;

  @property({ type: Boolean })
  short = false;

  @property({ type: String })
  color!: string;

  @property({ attribute: false })
  loading = true;

  @property({ attribute: false })
  profile: any = {};

  @property({ attribute: false })
  image: any | undefined = undefined;

  @query('#blockie-canvas')
  blockie!: HTMLElement;

  async firstUpdated() {
    this.load();
  }

  updated(changedProperties) {
    if (changedProperties.has('userId')) {
      this.load();
    }
  }

  async load() {
    this.image = undefined;
    this.profile = {};
    this.profile.userId = this.address;

    /** wait so that the canvas blockie is alraedy rendered */
    this.requestUpdate();
    await this.updateComplete;

    if (this.blockie != null) {
      blockies.render(
        {
          seed: this.profile.userId,
          size: 8,
          scale: 4,
        },
        this.blockie
      );
    }

    this.profile.userId = this.address;
    this.image = this.profile.image
      ? `https://ipfs.io/ipfs/${this.profile.image[0].contentUrl['/']}`
      : undefined;

    this.requestUpdate();
  }

  clicked() {
    if (this.profile.url) {
      window.location = this.profile.url;
    }
  }

  render() {
    if (this.profile.userId === undefined) return '';
    let addressBoxClasses = ['box-address-txt'];
    if (this.short) {
      addressBoxClasses.push('box-address-shorter');
    } else {
      addressBoxClasses.push('box-address-short');
    }
    return html`
      <div class="box-address">
        <div
          class="box-img"
          style="${styleMap({
            borderColor: this.color,
          })}"
        >
          ${this.image !== undefined
            ? html` <img src=${this.image} /> `
            : html` <canvas id="blockie-canvas"></canvas> `}
          }
        </div>

        ${this.showName
          ? html`
              <div class=${addressBoxClasses.join(' ')}>
                ${this.profile.name ? this.profile.name : this.profile.userId}
              </div>
            `
          : ''}
      </div>
    `;
  }

  static get styles() {
    const baseTileHeight = css`28px`;
    return css`
      :host {
        width: fit-content;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .box-address {
        background: transparent;
        height: fit-content;
        padding: 0px;
        position: relative;
        width: fit-content;
        display: flex;
        justify-content: flex-start;
        align-items: center;
      }

      .box-address .box-img {
        background: rgb(7, 73, 136);
        height: ${baseTileHeight};
        width: ${baseTileHeight};
        border-radius: 50%;
        overflow: hidden;
        border-style: solid;
        border-width: 2px;
      }

      .box-address .box-img img {
        height: 100%;
        width: 100%;
        object-fit: cover;
        background-color: white;
      }

      .box-address-txt {
        color: var(--color, rgb(99, 102, 104));
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.015em;
        display: block;
        margin-left: 6px;
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
      }
      .box-address-short {
        max-width: 200px;
      }
      .box-address-shorter {
        max-width: 100px;
      }
    `;
  }
}
