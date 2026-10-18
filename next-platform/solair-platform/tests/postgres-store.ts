import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { Store } from "../server/db";
export class PostgresTestStore extends Store {
  private engine: any = new PGlite();
  constructor() {
    super(":memory:");
  }
  private sql(s: string) {
    let i = 0;
    return s.replace(/\?/g, () => `$${++i}`);
  }
  override async query(s: string, args: any[] = []): Promise<any[]> {
    return (await this.engine.query(this.sql(s), args)).rows;
  }
  override async run(s: string, args: any[] = []) {
    await this.engine.query(this.sql(s), args);
  }
  override async migrate() {
    await this.engine.exec(
      readFileSync(
        new URL("../backend/migrations/001_core.sql", import.meta.url),
        "utf8",
      ),
    );
    await this.engine.exec(readFileSync(new URL("../backend/migrations/003_cpe.sql", import.meta.url),"utf8"));
    await this.engine.exec(readFileSync(new URL('../backend/migrations/005_operations.sql',import.meta.url),'utf8'));
    await this.engine.exec(readFileSync(new URL('../backend/migrations/007_registration.sql',import.meta.url),'utf8'));
    await this.engine.exec(readFileSync(new URL('../backend/migrations/009_registration_details.sql',import.meta.url),'utf8'));
  }
  override async transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T> {
    return this.engine.transaction(async (tx: any) => {
      const store = Object.create(
        PostgresTestStore.prototype,
      ) as PostgresTestStore;
      store.engine = tx;
      return fn(store);
    });
  }
  override async close() {
    await this.engine.close();
    await super.close();
  }
}
