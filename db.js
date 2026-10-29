const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function openDatabase(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, 'playerok-control.sqlite'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      account_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (account_id, key),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS plugin_settings (
      plugin_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      level TEXT NOT NULL,
      message TEXT NOT NULL
    );
  `);

  const statements = {
    listAccounts: db.prepare('SELECT id, label, created_at FROM accounts ORDER BY id'),
    addAccount: db.prepare('INSERT INTO accounts (label) VALUES (?)'),
    removeAccount: db.prepare('DELETE FROM accounts WHERE id = ?'),
    getSetting: db.prepare('SELECT value FROM settings WHERE account_id = ? AND key = ?'),
    setSetting: db.prepare(`
      INSERT INTO settings (account_id, key, value) VALUES (?, ?, ?)
      ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value
    `),
    getAppSetting: db.prepare('SELECT value FROM app_settings WHERE key = ?'),
    setAppSetting: db.prepare(`
      INSERT INTO app_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `),
    listPlugins: db.prepare('SELECT plugin_id, enabled FROM plugin_settings ORDER BY plugin_id'),
    setPlugin: db.prepare(`
      INSERT INTO plugin_settings (plugin_id, enabled) VALUES (?, ?)
      ON CONFLICT(plugin_id) DO UPDATE SET enabled = excluded.enabled
    `),
    addEvent: db.prepare('INSERT INTO events (level, message) VALUES (?, ?)'),
    recentEvents: db.prepare('SELECT created_at, level, message FROM events ORDER BY id DESC LIMIT 10')
  };

  return {
    raw: db,
    listAccounts: () => statements.listAccounts.all(),
    addAccount: (label) => Number(statements.addAccount.run(label).lastInsertRowid),
    removeAccount: (id) => statements.removeAccount.run(id).changes > 0,
    getSetting: (accountId, key, fallback = 'false') =>
      statements.getSetting.get(accountId, key)?.value ?? fallback,
    setSetting: (accountId, key, value) => statements.setSetting.run(accountId, key, String(value)),
    getAppSetting: (key, fallback = '') => statements.getAppSetting.get(key)?.value ?? fallback,
    setAppSetting: (key, value) => statements.setAppSetting.run(key, String(value)),
    listPlugins: () => statements.listPlugins.all(),
    setPlugin: (id, enabled) => statements.setPlugin.run(id, enabled ? 1 : 0),
    addEvent: (level, message) => statements.addEvent.run(level, message),
    recentEvents: () => statements.recentEvents.all(),
    close: () => db.close()
  };
}

module.exports = { openDatabase };
