/**
 * @project AncestorTree
 * @file src/app/api/desktop-db/sqlite-db.ts
 * @description Singleton sql.js database with flush-to-disk persistence.
 *              CTO condition A: in-memory DB + flushToDisk() after every write.
 * @version 1.0.0
 * @updated 2026-02-26
 */

import initSqlJs, { type Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

let db: Database | null = null;
let dbPath: string = '';

function getDataDir(): string {
  return process.env.DESKTOP_DATA_DIR || path.join(os.homedir(), 'AncestorTree');
}

function getDbPath(): string {
  if (!dbPath) {
    dbPath = path.join(getDataDir(), 'data', 'ancestortree.db');
  }
  return dbPath;
}

/** Get or create the singleton database instance */
export async function getDatabase(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: () => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  });

  const filePath = getDbPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL-like behavior (though sql.js is in-memory)
  db.run('PRAGMA journal_mode = MEMORY');
  db.run('PRAGMA foreign_keys = ON');

  return db;
}

/**
 * Flush the in-memory database to disk.
 * Uses atomic write: write to .tmp then rename to prevent corruption.
 */
export function flushToDisk(): void {
  if (!db) return;

  const filePath = getDbPath();
  const tmpPath = filePath + '.tmp';

  const data = db.export();
  const buffer = Buffer.from(data);

  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, filePath);
}

/** Check if database file exists (for first-run detection) */
export function databaseExists(): boolean {
  return fs.existsSync(getDbPath());
}

/** Run initial migrations if needed */
export async function runMigrations(): Promise<void> {
  const database = await getDatabase();

  // Create migrations tracking table
  database.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Load and run migration files from desktop/migrations/
  const migrationsDir = path.join(process.cwd(), '..', 'desktop', 'migrations');
  // Fallback: check if migrations are bundled alongside
  const altMigrationsDir = path.join(getDataDir(), 'migrations');

  const migrationsDirs = [migrationsDir, altMigrationsDir];
  let migrationFiles: string[] = [];

  for (const dir of migrationsDirs) {
    if (fs.existsSync(dir)) {
      migrationFiles = fs.readdirSync(dir)
        .filter(f => f.endsWith('.sql'))
        .sort();
      if (migrationFiles.length > 0) {
        // Run pending migrations
        for (const file of migrationFiles) {
          const [applied] = database.exec(
            `SELECT 1 FROM _migrations WHERE name = '${file}'`
          );
          if (!applied || applied.values.length === 0) {
            const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
            database.exec(sql);
            database.run(`INSERT INTO _migrations (name) VALUES ('${file}')`);
          }
        }
        flushToDisk();
        break;
      }
    }
  }
}
