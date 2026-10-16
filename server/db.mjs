import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export const family = ['Caíque Eduardo','Estephane','Jéssica Rafaela','Igor','Caio','Rafael','Iris Ferreira','Augusto','Lucas Rodrigo','Camila Dias','Jenifer','Erick'];
export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), started_at TEXT);
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      code_hash TEXT, confirmed_at TEXT, revealed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS pairs (
      giver INTEGER PRIMARY KEY REFERENCES participants(id),
      receiver INTEGER NOT NULL UNIQUE REFERENCES participants(id), CHECK(giver != receiver)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      hash TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('admin','participant')),
      participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE, expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, action TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    INSERT OR IGNORE INTO settings(id) VALUES(1);
    CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY);
  `);
  if (!db.prepare('SELECT 1 FROM migrations WHERE version=1').get()) {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const name of family) db.prepare('INSERT OR IGNORE INTO participants(name) VALUES(?)').run(name);
      db.exec('INSERT INTO migrations(version) VALUES(1); COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  return db;
}
