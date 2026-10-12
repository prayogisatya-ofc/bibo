import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";

export type OpenCodeClient = ReturnType<typeof OpenCode.make>;

/** Versi mayor yang didukung bridge. */
export const SUPPORTED_MAJOR = "2.";

export interface Connection {
  client: OpenCodeClient;
  version: string;
}

/** Hubungkan ke OpenCode v2: OPENCODE_URL manual atau Service.ensure().
 *  Menolak server yang bukan v2.x (FR-002). */
export async function connect(urlOverride?: string): Promise<Connection> {
  let client: OpenCodeClient;
  if (urlOverride) {
    client = OpenCode.make({ baseUrl: urlOverride });
  } else {
    const endpoint = await Service.ensure({ version: (v) => v.startsWith(SUPPORTED_MAJOR) });
    client = OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) });
  }
  const info = await client.server.info();
  if (!info.version.startsWith(SUPPORTED_MAJOR)) {
    throw new Error(`CodePet membutuhkan OpenCode v2, server melaporkan ${info.version}`);
  }
  return { client, version: info.version };
}
