import { UprtclRemote } from "../../uprtcl.remote";
import { Logger } from "@uprtcl/micro-orchestrator";
import { HttpConnection } from "@uprtcl/connections";
import { Perspective, PerspectiveDetails, Commit, Context } from './../../../../types'; 
import { AccessControlService } from "../../../../access-control/services/access-control.service";
import { ProposalProvider } from "../../proposal.provider";
import { Hashed } from "@uprtcl/cortex";

export class UprtclHttp implements UprtclRemote {
    
  uprtcl_api: string = 'uprtcl-v1';
  connection!: HttpConnection;
  logger = new Logger('HTTP-UPRTCL-PROVIDER');
  accessControl: AccessControlService | undefined;
  proposals: ProposalProvider | undefined;

  constructor (protected host: string, jwt: string) {
    this.connection = new HttpConnection(host, jwt);
  }
  
  get<T extends object>(hash: string): Promise<Hashed<T> | undefined> {
    return this.connection.get<Object>('/get');
  }

  ready(): Promise<void> {
    return Promise.resolve();
  }

  get name() : string {
    return `http:${this.uprtcl_api}:+${this.host}`;
  } 

  configure(sourceName: string): boolean {
    throw new Error("Method not implemented.");
  }

  clonePerspective(perspective: any): Promise<void> {
    return this.connection.post('/persp', perspective);
  }

  cloneCommit(commit: any): Promise<void> {
    return this.connection.post('/commit', commit);
  }

  updatePerspectiveDetails(perspectiveId: string, details: Partial<PerspectiveDetails>): Promise<void> {
    return this.connection.put(`/persp/${perspectiveId}/details`, details);
  }

  getContextPerspectives(context: string): Promise<any[]> {
    return this.connection.get(`/persp?context=${context}`);
  }

  getPerspectiveDetails(perspectiveId: string): Promise<PerspectiveDetails> {
    return this.connection.get(`/persp/${perspectiveId}/details`);
  }

}