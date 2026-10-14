import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import * as tables from './schema.js';

/**
 * Database access.
 *
 * This file is the ONLY place that knows which driver is in use. Application
 * code imports `Database` and never names libSQL, which is what keeps the
 * "swap to hosted Postgres is a config change" promise honest.
 *
 * libSQL rather than better-sqlite3 because it ships prebuilt binaries — no
 * node-gyp, no Visual Studio Build Tools, which this dev machine does not have.
 * A `file:` URL writes to a local SQLite file; a `libsql://` URL talks to a
 * hosted database through the same code path.
 */

export { tables };

export type Database = ReturnType<typeof createDatabase>;

export interface DatabaseHandle {
  db: Database;
  client: Client;
  close(): void;
}

/** No explicit return annotation: `Database` is derived from this function, so
 *  annotating it here would be circular. */
export function createDatabase(url: string, authToken?: string) {
  const client = createClient({
    url,
    ...(authToken === undefined ? {} : { authToken }),
  });
  return drizzle(client, { schema: tables });
}

export function openDatabase(url: string, authToken?: string): DatabaseHandle {
  const client = createClient({
    url,
    ...(authToken === undefined ? {} : { authToken }),
  });
  const db = drizzle(client, { schema: tables });
  return {
    db,
    client,
    close: () => {
      client.close();
    },
  };
}

/** True when the URL points at a local file rather than a remote database. */
export function isLocalDatabase(url: string): boolean {
  return url.startsWith('file:') || url.startsWith(':memory:');
}
