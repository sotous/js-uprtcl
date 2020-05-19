import { MicroOrchestrator, i18nextBaseModule } from '@uprtcl/micro-orchestrator';
import { LensesModule } from '@uprtcl/lenses';
import { DocumentsModule } from '@uprtcl/documents';

import { CortexModule } from '@uprtcl/cortex';
import { AccessControlModule } from '@uprtcl/access-control';
import { EveesModule, EveesHolochain } from '@uprtcl/evees';

import { HolochainConnection } from '@uprtcl/holochain-provider';

import { ApolloClientModule } from '@uprtcl/graphql';
import { DiscoveryModule } from '@uprtcl/multiplatform';

import { SimpleEditor } from './simple-editor';

(async function() {
  const holochainConnection = new HolochainConnection({
    host: 'ws://localhost:8888'
  })

  const holochainEvees = new EveesHolochain(holochainConnection);

  const evees = new EveesModule([holochainEvees], holochainEvees);

  const documents = new DocumentsModule([holochainEvees]);

  const orchestrator = new MicroOrchestrator();

  const modules = [
    new i18nextBaseModule(),
    new ApolloClientModule(),
    new CortexModule(),
    new DiscoveryModule(),
    new LensesModule(),
    new AccessControlModule(),
    evees,
    documents
  ];

  await orchestrator.loadModules(modules);

  console.log(orchestrator);
  customElements.define('simple-editor', SimpleEditor);
})();
