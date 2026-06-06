/**
 * SQLite Database Schema & Initialization using sql.js (pure JS SQLite).
 * No native compilation needed.
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const SCHEMA_VERSION = 1;

/**
 * Initialize the database at the given path.
 * @param {string} dbPath - Absolute path to the .sqlite file
 * @returns {Promise<Object>} The initialized sql.js database + save function
 */
async function initDatabase(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();

  let db;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Performance pragmas
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_info (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scrape_id TEXT NOT NULL,
      scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
      mod_name TEXT NOT NULL,
      category TEXT,
      socket_type TEXT,
      required_rank TEXT,
      price INTEGER NOT NULL,
      platform TEXT,
      reroll_count INTEGER DEFAULT 0,
      seller_name TEXT,
      seller_status TEXT,
      seller_rank TEXT,
      reg_date TEXT,
      available_characters TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS listing_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      stat_name TEXT NOT NULL,
      stat_value TEXT,
      is_positive INTEGER DEFAULT 1,
      is_negative INTEGER DEFAULT 0,
      raw_label TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scrape_id TEXT NOT NULL,
      mod_name TEXT NOT NULL,
      platform TEXT,
      median_price INTEGER,
      min_price INTEGER,
      max_price INTEGER,
      volume INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Schema Migration
  try {
    db.run('ALTER TABLE listings ADD COLUMN available_characters TEXT;');
  } catch (err) {
    // Column likely exists
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS daily_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      mod_name TEXT NOT NULL,
      platform TEXT,
      stat_signature TEXT,
      median_price INTEGER,
      avg_price REAL,
      min_price INTEGER,
      max_price INTEGER,
      listing_count INTEGER,
      UNIQUE(date, mod_name, platform, stat_signature)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tracked_mods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mod_name TEXT NOT NULL,
      stats TEXT,
      platform TEXT DEFAULT 'PC',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_listings_name ON listings(mod_name)',
    'CREATE INDEX IF NOT EXISTS idx_listings_scraped ON listings(scraped_at)',
    'CREATE INDEX IF NOT EXISTS idx_listings_scrape_id ON listings(scrape_id)',
    'CREATE INDEX IF NOT EXISTS idx_listing_stats_lid ON listing_stats(listing_id)',
    'CREATE INDEX IF NOT EXISTS idx_daily_name_date ON daily_prices(mod_name, date)',
    'CREATE INDEX IF NOT EXISTS idx_daily_platform ON daily_prices(platform, date)',
    'CREATE INDEX IF NOT EXISTS idx_tracked_name ON tracked_mods(mod_name)',
  ];
  indexes.forEach(sql => db.run(sql));

  // Save function
  const save = () => {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  };

  // Auto-save periodically
  const saveInterval = setInterval(save, 30000); // Every 30 seconds

  return { db, save, close: () => { clearInterval(saveInterval); save(); db.close(); } };
}

module.exports = { initDatabase, SCHEMA_VERSION };
