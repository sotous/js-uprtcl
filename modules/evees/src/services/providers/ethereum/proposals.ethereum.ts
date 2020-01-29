import { Hashed } from '@uprtcl/cortex';
import { EthereumProvider } from '@uprtcl/ethereum-provider';
import { IpfsSource } from '@uprtcl/ipfs-provider';

import { ProposalsProvider } from '../../proposals.provider';
import { Proposal, UpdateRequest } from '../../../types';
import { hashCid, INIT_REQUEST } from './common';
import { EveesAccessControlEthereum } from './evees-access-control.ethereum';
import { Logger } from '@uprtcl/micro-orchestrator';

export interface EthHeadUpdate {
  perspectiveIdHash: string;
  headId: string;
  executed: number;
}

export interface EthMergeRequest {
  id?: string;
  toPerspectiveId: string;
  fromPerspectiveId: string;
  owner: string;
  nonce?: number;
  headUpdates: EthHeadUpdate[];
  approvedAddresses: string[];
  status?: number;
  authorized?: number;
}

export class ProposalsEthereum implements ProposalsProvider {

  logger = new Logger('PROPOSALS-ETHEREUM');

  constructor(
    protected ethProvider: EthereumProvider,
    protected ipfsSource: IpfsSource,
    protected accessControl: EveesAccessControlEthereum
  ) {}

  async ready(): Promise<void> {
    await Promise.all([this.ethProvider.ready(), this.ipfsSource.ready()]);
  }

  getProposalsToPerspective(perspectiveId: string): Promise<Array<Proposal>> {
    throw new Error('Method not implemented.');
  }

  async createProposal(
    fromPerspectiveId: string,
    toPerspectiveId: string,
    headUpdates: UpdateRequest[]
  ): Promise<string> {
    this.logger.info('createProposal()', { fromPerspectiveId, toPerspectiveId, headUpdates });

    const ethHeadUpdatesPromises = headUpdates.map(
      async (update): Promise<EthHeadUpdate> => {
        return {
          perspectiveIdHash: await hashCid(update.perspectiveId),
          headId: update.newHeadId,
          executed: 0
        };
      }
    );

    const ethHeadUpdates = await Promise.all(ethHeadUpdatesPromises);

    /** TX is sent, and await to force order (preent head update on an unexisting perspective) */
    let toPerspectiveIdHash = await hashCid(toPerspectiveId);
    let fromPerspectiveIdHash = await hashCid(fromPerspectiveId);

    const nonce = 0;
    const accessData = await this.accessControl.getAccessControlInformation(toPerspectiveIdHash);

    if (!accessData)
      throw new Error(`access control data not found for target perspective ${toPerspectiveId}`);

    /** verify all perspectives are owned by that address */
    const verifyPromises = ethHeadUpdates.map(async headUpdate => {
      const thisAccessData = await this.accessControl.getAccessControlInformation(
        toPerspectiveIdHash
      );
      if (!thisAccessData)
        throw new Error(`access control data not found for target perspective ${toPerspectiveId}`);

      if (thisAccessData.owner !== accessData.owner) {
        throw new Error(
          `perspective ${headUpdate.perspectiveIdHash} in request not owned by target perspective owner ${accessData.owner} but by ${thisAccessData.owner}`
        );
      }
    });

    await Promise.all(verifyPromises);

    await this.ethProvider.send(INIT_REQUEST, [
      toPerspectiveIdHash,
      fromPerspectiveIdHash,
      accessData.owner,
      nonce,
      ethHeadUpdates,
      [],
      toPerspectiveId,
      fromPerspectiveId
    ]);

    /** check logs to get the requestId (batchId) */
    let createdEvents = await this.ethProvider.contractInstance.getPastEvents(
      'MergeRequestCreated',
      {
        filter: {
          toPerspectiveIdHash: toPerspectiveIdHash,
          fromPerspectiveIdHash: fromPerspectiveIdHash
        },
        fromBlock: 0
      }
    );

    let requestId = createdEvents.filter(e => parseInt(e.returnValues.nonce) === nonce)[0]
      .returnValues.requestId;

    this.logger.info('createProposal()', { requestId, headUpdates });

    return requestId;
  }

  updateProposal(proposalId: string, requests: UpdateRequest[]): Promise<void> {
    throw new Error('Method not implemented.');
  }

  cancelProposal(proposalId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  declineUpdateRequests(updateRequestIds: string[]): Promise<void> {
    throw new Error('Method not implemented.');
  }

  acceptUpdateRequests(updateRequestIds: string[]): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
