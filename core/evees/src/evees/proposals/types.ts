import { EveesMutationCreate } from '../interfaces/types';
export interface Proposal {
  creatorId?: string;
  timestamp?: number;
  toPerspectiveId: string;
  fromPerspectiveId?: string;
  toHeadId?: string;
  fromHeadId?: string;
  mutation: EveesMutationCreate;
}
