import { DatabaseSync } from "node:sqlite";
import { Pool, type PoolClient } from "pg";
import { mkdirSync, readFileSync } from "node:fs";
export class Store {
  private sqlite?: DatabaseSync;
  private pg?: Pool;
  private client?: PoolClient;
  constructor(path = process.env.SOLAIR_DB_PATH || "data/solair.db") {
    if (process.env.DATABASE_URL && path !== ":memory:") {
      const url=new URL(process.env.DATABASE_URL);
      const ca=process.env.SOLAIR_DATABASE_CA;
      if(ca){for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);}
      this.pg = new Pool({ connectionString: url.toString(), ...(ca?{ssl:{ca:ca.replace(/\\n/g,'\n'),rejectUnauthorized:true}}:{}) });
    }
    else {
      if (path !== ":memory:") mkdirSync("data", { recursive: true });
      this.sqlite = new DatabaseSync(path);
      this.sqlite.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
    }
  }
  async query(sql: string, args: any[] = []): Promise<any[]> {
    if (this.pg || this.client) {
      let i = 0;
      return (
        await (this.client || this.pg!).query(
          sql.replace(/\?/g, () => `$${++i}`),
          args,
        )
      ).rows;
    }
    return this.sqlite!.prepare(sql).all(...args);
  }
  async run(sql: string, args: any[] = []) {
    if (this.pg || this.client) {
      let i = 0;
      await (this.client || this.pg!).query(
        sql.replace(/\?/g, () => `$${++i}`),
        args,
      );
    } else this.sqlite!.prepare(sql).run(...args);
  }
  async transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T> {
    if (this.pg) {
      const client = await this.pg.connect();
      const tx = Object.create(Store.prototype) as Store;
      tx.client = client;
      try {
        await client.query("BEGIN");
        const result = await fn(tx);
        await client.query("COMMIT");
        return result;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }
    this.sqlite!.exec("BEGIN IMMEDIATE");
    try {
      const r = await fn(this);
      this.sqlite!.exec("COMMIT");
      return r;
    } catch (e) {
      this.sqlite!.exec("ROLLBACK");
      throw e;
    }
  }
  async migrate() {
    const sql = readFileSync(
      new URL("../backend/migrations/001_core.sql", import.meta.url),
      "utf8",
    );
    if (this.pg) await this.pg.query(sql);
    else this.sqlite!.exec(sql);
    const operations = readFileSync(new URL('../backend/migrations/005_operations.sql', import.meta.url),'utf8');
    if (this.pg) await this.pg.query(operations); else this.sqlite!.exec(operations);
    const registration=readFileSync(new URL('../backend/migrations/007_registration.sql',import.meta.url),'utf8');
    if(this.pg)await this.pg.query(registration);else this.sqlite!.exec(registration);
    const details=readFileSync(new URL('../backend/migrations/009_registration_details.sql',import.meta.url),'utf8');
    if(this.pg)await this.pg.query(details);else this.sqlite!.exec(details);
    const cpe = readFileSync(new URL("../backend/migrations/003_cpe.sql", import.meta.url), "utf8");
    if (this.pg) {
      await this.pg.query(cpe);
      await this.pg.query("ALTER TABLE cpe_samples ENABLE ROW LEVEL SECURITY");
    } else this.sqlite!.exec(cpe);
    if(this.pg && process.env.SOLAIR_AUTH_PROVIDER==='supabase') await this.pg.query(readFileSync(new URL('../backend/migrations/002_supabase.sql',import.meta.url),'utf8'));
    if(this.pg && process.env.SOLAIR_AUTH_PROVIDER==='supabase') await this.pg.query(readFileSync(new URL('../backend/migrations/004_cpe_supabase.sql',import.meta.url),'utf8'));
    if(this.pg && process.env.SOLAIR_AUTH_PROVIDER==='supabase') await this.pg.query(readFileSync(new URL('../backend/migrations/006_operations_supabase.sql',import.meta.url),'utf8'));
    if(this.pg && process.env.SOLAIR_AUTH_PROVIDER==='supabase') await this.pg.query(readFileSync(new URL('../backend/migrations/008_registration_supabase.sql',import.meta.url),'utf8'));
    if(this.pg && process.env.SOLAIR_AUTH_PROVIDER==='supabase') await this.pg.query(readFileSync(new URL('../backend/migrations/010_registration_details_supabase.sql',import.meta.url),'utf8'));
  }
  async close() {
    if (this.pg) await this.pg.end();
    else this.sqlite!.close();
  }
}
