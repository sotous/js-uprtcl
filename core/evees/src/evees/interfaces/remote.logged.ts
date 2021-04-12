import { ConnectionLogged } from '../../utils/connection.logged';
import { Ready } from '../../utils/ready';

export enum RemoteLoggedEvents {
  logged_out = 'logged_out',
  logged_in = 'logged_in',
  logged_status_changed = 'logged_status_changed',
}

export interface RemoteLogged extends Ready, ConnectionLogged {
  /**
   * The id is used to select the JS remote from the listed of available Remotes.
   * A path is used to addreess a given request to that remote.
   * The defaultPath is used to simplify "get" or "create"s operations that dont receive a path.
   */
  id: string;
  defaultPath: string;
}
