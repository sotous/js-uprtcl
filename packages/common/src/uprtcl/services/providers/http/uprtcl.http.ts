import { UprtclRemote } from "../../uprtcl.remote";
import { Logger } from "@uprtcl/micro-orchestrator";
import { HttpConnection } from "@uprtcl/connections";

export class UprtclHttp implements UprtclRemote {
  logger: Logger = new Logger('UPRTCL-ETH');

  connection!: HttpConnection;

}