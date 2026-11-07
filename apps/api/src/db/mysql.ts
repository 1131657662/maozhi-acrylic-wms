import { createPool, type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';

export interface DatabaseConfig { host: string; port: number; user: string; password: string; database?: string }
export type Row = Record<string, unknown>;
type Values = readonly (string | number | null)[];

export class Database {
  constructor(private readonly executor: Pool | PoolConnection, private readonly pool?: Pool) {}
  async all(sql: string, values: Values = []): Promise<Row[]> {
    const [rows] = await this.executor.query<RowDataPacket[]>(sql, [...values]);
    return rows;
  }
  async get(sql: string, values: Values = []): Promise<Row | undefined> {
    return (await this.all(sql, values))[0];
  }
  async run(sql: string, values: Values = []): Promise<{ changes: number }> {
    const [result] = await this.executor.query<ResultSetHeader>(sql, [...values]);
    return { changes: result.affectedRows };
  }
  async withConnection<T>(work: (db: Database) => Promise<T>): Promise<T> {
    if (!this.pool) return work(this);
    const connection = await this.pool.getConnection();
    try { return await work(new Database(connection)); }
    finally { connection.release(); }
  }
  async transaction<T>(work: (db: Database) => Promise<T>): Promise<T> {
    if (!this.pool) return work(this);
    return this.withConnection(async (db) => {
      await db.run('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await db.run('START TRANSACTION');
      try { const result = await work(db); await db.run('COMMIT'); return result; }
      catch (error) { await db.run('ROLLBACK'); throw error; }
    });
  }
  async close(): Promise<void> { if (this.pool) await this.pool.end(); }
}

export function openDatabase(config: DatabaseConfig): Database {
  const pool = createPool({
    ...config, charset: 'utf8mb4', timezone: 'Z', dateStrings: true,
    decimalNumbers: false, supportBigNumbers: true, bigNumberStrings: true,
    connectionLimit: 8, multipleStatements: false, connectTimeout: 5000,
  });
  return new Database(pool, pool);
}
