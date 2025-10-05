import sqlite3 from 'sqlite3';
import fs from 'fs';

const dbPath = '/tmp/googleai_agent.db';
let db: sqlite3.Database;

export function connectToDatabase(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Connected to the SQLite database.');
        db = connection;
        resolve(db);
      }
    });
  });
}

export function getDb(): sqlite3.Database {
  if (!db) {
    throw new Error('Database not initialized. Call connectToDatabase first.');
  }
  return db;
}

export function run(sql: string, params: any[] = []): Promise<{ lastID: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID });
      }
    });
  });
}

export function get<T>(sql: string, params: any[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as T | null);
      }
    });
  });
}

export function all<T>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows as T[]);
      }
    });
  });
}

export async function initializeDatabase(): Promise<void> {
  await run(`CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);
  await run(`CREATE TABLE IF NOT EXISTS data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    file_content TEXT NOT NULL
  )`);
}

export async function resetDatabase(): Promise<void> {
  const tables = await all<{ name: string }>(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`);
  for (const table of tables) {
    await run(`DELETE FROM ${table.name};`);
  }
}

export function removeDatabaseFile(): void {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('Existing database file removed.');
  }
}

