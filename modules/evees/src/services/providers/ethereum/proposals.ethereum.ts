import { IpfsSource } from '@uprtcl/ipfs-provider';
import { Logger } from '@uprtcl/micro-orchestrator';
import { EthereumContract } from '@uprtcl/ethereum-provider';

import { ProposalsProvider } from '../../proposals.provider';
import { UpdateRequest, Proposal } from '../../../types';
import { hashCid, INIT_PROPOSAL, GET_PROPOSAL, AUTHORIZE_PROPOSAL, EXECUTE_PROPOSAL } from './common';
import { EveesAccessControlEthereum } from './evees-access-control.ethereum';
import { hashToId } from './evees.ethereum';

export interface EthHeadUpdate {
  perspectiveIdHash: string;
  headId: string;
  executed: string;
}

export interface EthMergeRequest {
  id?: string;
  toPerspectiveId: string;
  fromPerspectiveId: string;
  owner: string;
  nonce?: number;
  headUpdates: EthHeadUpdate[];
  approvedAddresses: string[];
  status?: string;
  authorized?: string;
}

export interface EthRequestCreatedEvent {
  toPerspectiveIdHash: string,
  fromPerspectiveIdHash: string,
  nonce: number,
  requestId: string,
  toPerspectiveId: string,
  fromPerspectiveId: string,
  creator: string
}

export class ProposalsEthereum implements ProposalsProvider {
  
  logger = new Logger('PROPOSALS-ETHEREUM');

  constructor(
    protected uprtclRoot: EthereumContract,
    protected uprtclProposals: EthereumContract,
    protected ipfsSource: IpfsSource,
    protected accessControl: EveesAccessControlEthereum
  ) {}

  async ready(): Promise<void> {
    await Promise.all([this.uprtclProposals.ready(), this.ipfsSource.ready()]);
  }

  async createProposal(
    fromPerspectiveId: string,
    toPerspectiveId: string,
    headUpdates: UpdateRequest[]
  ): Promise<string> {
    await this.ready();

    this.logger.info('createProposal()', { fromPerspectiveId, toPerspectiveId, headUpdates });

    /** verify all perspectives are owned by the owner of the to perspective (which might not be in the updateHead list) */
    const accessData = await this.accessControl.getPermissions(toPerspectiveId);
    
    if (!accessData)
      throw new Error(`access control data not found for target perspective ${toPerspectiveId}`);

    const verifyPromises = headUpdates.map(async headUpdate => {
      const permissions = await this.accessControl.getPermissions(
        headUpdate.perspectiveId
      );
      if (!permissions)
        throw new Error(`access control data not found for target perspective ${toPerspectiveId}`);

      if (permissions.owner !== accessData.owner) {
        throw new Error(
          `perspective ${headUpdate.perspectiveId} in request not owned by target perspective owner ${accessData.owner} but by ${permissions.owner}`
        );
      }
    });

    await Promise.all(verifyPromises);

    /** TX is sent, and await to force order (preent head update on an unexisting perspective) */
    const nonce = 0;

    const ethHeadUpdatesPromises = headUpdates.map(
      async (update): Promise<EthHeadUpdate> => {
        return {
          perspectiveIdHash: await hashCid(update.perspectiveId),
          headId: update.newHeadId,
          executed: "0"
        };
      }
    );

    const ethHeadUpdates = await Promise.all(ethHeadUpdatesPromises);

    const toPerspectiveIdHash = await hashCid(toPerspectiveId);
    const fromPerspectiveIdHash = await hashCid(fromPerspectiveId);

    const proposal = {
      toPerspectiveIdHash: toPerspectiveIdHash, 
      fromPerspectiveIdHash: fromPerspectiveIdHash, 
      owner: accessData.owner, 
      nonce: nonce, 
      headUpdates: ethHeadUpdates, 
      approvedAddresses: []
    }

    await this.uprtclProposals.send(INIT_PROPOSAL, [
      proposal, this.uprtclProposals.userId
    ]);

    /** check logs to get the requestId (batchId) */
    const createdEvents = await this.uprtclProposals.contractInstance.getPastEvents(
      'MergeRequestCreated',
      {
        filter: {
          toPerspectiveIdHash: toPerspectiveIdHash,
          fromPerspectiveIdHash: fromPerspectiveIdHash
        },
        fromBlock: 0
      }
    );

    const requestId = createdEvents.filter(e => parseInt(e.returnValues.nonce) === nonce)[0]
      .returnValues.requestId;

    this.logger.info('createProposal() - post', { requestId, headUpdates });

    return requestId;
  }

  async getProposal(requestId: string): Promise<Proposal> {
    await this.ready();

    this.logger.info('getProposal() - pre', { requestId });

    const request: EthMergeRequest = await this.uprtclProposals.call(
      GET_PROPOSAL, 
      [ requestId ]);

    let requestCreatedEvents = await this.uprtclProposals.contractInstance.getPastEvents(
      'MergeRequestCreated',
      {
        filter: {
          requestId,
        },
        fromBlock: 0
      }
    );

    if (requestCreatedEvents.length === 0) {
      throw new Error(`Request creationg event not found for ${requestId}`);
    }

    const requestEventValues = (requestCreatedEvents[0].returnValues as EthRequestCreatedEvent);
    
    const ethHeadUpdates = request.headUpdates;

    const updatesPromises = ethHeadUpdates.map(async (ethUpdateRequest) => {
      const perspectiveId = await hashToId(this.uprtclRoot, ethUpdateRequest.perspectiveIdHash);

      return {
        perspectiveId: perspectiveId,
        newHeadId: ethUpdateRequest.headId
      }
    });

    const updates = await Promise.all(updatesPromises);
    
    const executed = (ethHeadUpdates.find(update => update.executed === "0") === undefined);
    const canAuthorize = (this.uprtclProposals.userId !== undefined) ? 
      (request.owner.toLocaleLowerCase() === this.uprtclProposals.userId.toLocaleLowerCase()) :
      false;

    const proposal: Proposal = {
      id: requestId,
      creatorId: requestEventValues.creator,
      toPerspectiveId: requestEventValues.toPerspectiveId,
      fromPerspectiveId: requestEventValues.fromPerspectiveId,
      updates: updates,
      status: request.status === '1',
      authorized: request.authorized === '1',
      executed: executed,
      canAuthorize: canAuthorize
    }

    this.logger.info('getProposal() - post', { proposal });

    return proposal;
  }

  async getProposalsToPerspective(perspectiveId: string): Promise<string[]> {
    await this.ready();

    this.logger.info('getProposalsToPerspective() - pre', { perspectiveId });

    let requestsCreatedEvents = await this.uprtclProposals.contractInstance.getPastEvents(
      'MergeRequestCreated', {
        filter: { toPerspectiveIdHash: await hashCid(perspectiveId) },
        fromBlock: 0
      }
    )

    const requestsIds = requestsCreatedEvents.map((event) => {
      return event.returnValues.requestId;
    })

    this.logger.info('getProposalsToPerspective() - post', { requestsIds });
    
    return requestsIds;
  }

  addUpdatesToProposal(proposalId: string, updates: any[]): Promise<void> {
    throw new Error("Method not implemented.");
  }

  freezeProposal(proposalId: string, updates: any[]): Promise<void> {
    throw new Error("Method not implemented.");
  }

  cancelProposal(proposalId: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  declineProposal(proposalId: string[]): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async acceptProposal(proposalId: string[]): Promise<void> {
    await this.ready();

    this.logger.info('acceptProposal()', { proposalId });

    await this.uprtclProposals.send(AUTHORIZE_PROPOSAL, [
      proposalId,
      1
    ]);
  }

  async executeProposal(proposalId: string[]): Promise<void> {
    await this.ready();

    this.logger.info('acceptProposal()', { proposalId });

    await this.uprtclProposals.send(EXECUTE_PROPOSAL, [
      proposalId
    ]);
  }

}
