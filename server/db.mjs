import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import familyNames from '../shared/participants.json' with { type: 'json' };
export const family = familyNames;
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
    CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY);
  `);
  if (!db.prepare('SELECT 1 FROM migrations WHERE version=1').get()) {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const name of family) db.prepare('INSERT OR IGNORE INTO participants(name) VALUES(?)').run(name);
      db.exec('INSERT INTO migrations(version) VALUES(1); COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  // One-time roster expansion: restart participation, preserving existing IDs.
  if (!db.prepare('SELECT 1 FROM migrations WHERE version=2').get()) {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const name of family) db.prepare('INSERT OR IGNORE INTO participants(name) VALUES(?)').run(name);
      db.exec("DELETE FROM pairs; UPDATE settings SET started_at=NULL WHERE id=1; UPDATE participants SET confirmed_at=NULL,revealed_at=NULL; DELETE FROM sessions WHERE role='participant'; INSERT INTO migrations(version) VALUES(2); COMMIT");
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  if (!db.prepare('SELECT 1 FROM migrations WHERE version=3').get()) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE participants SET name=? WHERE name=?').run('Agatha','Noah');
      db.exec('INSERT INTO migrations(version) VALUES(3); COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  if (!db.prepare('SELECT 1 FROM migrations WHERE version=4').get()) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(`CREATE TABLE pairs_exception (
        giver INTEGER PRIMARY KEY REFERENCES participants(id),
        receiver INTEGER NOT NULL REFERENCES participants(id),
        receiver_slot INTEGER NOT NULL DEFAULT 1 CHECK(receiver_slot IN (1,2)),
        CHECK(giver!=receiver),CHECK(receiver_slot=1 OR receiver=7),UNIQUE(receiver,receiver_slot));
        INSERT INTO pairs_exception(giver,receiver) SELECT giver,receiver FROM pairs;
        UPDATE pairs_exception SET receiver=7,receiver_slot=2 WHERE receiver=12;
        DROP TABLE pairs;ALTER TABLE pairs_exception RENAME TO pairs;
        INSERT INTO migrations(version) VALUES(4);COMMIT`);
    } catch(e){db.exec('ROLLBACK');throw e;}
  }
  return db;
}
