import { EveesContentModule, Logger } from '@uprtcl/evees';

import { EveesEthereumBindings } from './bindings';
import { ThreeBoxProfile } from './provider/threebox/threebox.profile';

export class EveesEthereumModule {
  static id = 'evees-ethereum-module';
  static bindings = EveesEthereumBindings;

  logger = new Logger('EVEES-ETHEREUM-MODULE');

  async onLoad() {
    customElements.define('threebox-profile', ThreeBoxProfile);
  }

  get submodules() {
    return [];
  }
}
