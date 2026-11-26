import sql from "mssql";

// One shared connection pool per running API instance.
// The API signs in to the database as its own app identity. No neighbor ever
// connects to the database directly.
let poolPromise: Promise<sql.ConnectionPool> | null = null;

function config(): sql.config {
  const need = (name: string): string => {
    const v = process.env[name];
    if (!v) throw new Error(`Missing setting ${name}`);
    return v;
  };
  return {
    server: need("SQL_SERVER"),
    database: need("SQL_DATABASE"),
    connectionTimeout: 30000,
    requestTimeout: 30000,
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    options: { encrypt: true, trustServerCertificate: false },
    authentication: {
      type: "azure-active-directory-service-principal-secret",
      options: {
        clientId: need("SQL_CLIENT_ID"),
        clientSecret: need("SQL_CLIENT_SECRET"),
        tenantId: need("SQL_TENANT_ID"),
      },
    },
  };
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config()).connect().catch((err) => {
      poolPromise = null; // let the next request try again
      throw err;
    });
  }
  return poolPromise;
}

/** True when the failure is the free database waking from sleep, or a dropped connection. */
export function isWakingUp(err: unknown): boolean {
  const e = err as { code?: string; number?: number; message?: string; originalError?: { code?: string } };
  const text = `${e?.code ?? ""} ${e?.originalError?.code ?? ""} ${e?.message ?? ""}`;
  return (
    e?.number === 40613 ||
    /ETIMEOUT|ESOCKET|ECONNCLOSED|ECONNRESET|ENOTOPEN|not currently available|is paused|resum/i.test(text)
  );
}

export function resetPool(): void {
  const p = poolPromise;
  poolPromise = null;
  p?.then((pool) => pool.close()).catch(() => undefined);
}

export { sql };
