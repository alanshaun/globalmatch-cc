/**
 * Local SQLite cache for search results (better-sqlite3)
 *
 * Tables:
 *   search_cache  — domain lists by cacheKey, with TTL
 *   search_audit  — per-query log: layer, duration, error (零静默失败 audit trail)
 *
 * DB file: ./data/search_cache.db (auto-created)
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// ── DB init ───────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "search_cache.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure data dir exists
  fs.mkdirSync(DATA_DIR, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");

  _db.exec(`
    CREATE TABLE IF NOT EXISTS search_cache (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key  TEXT    UNIQUE NOT NULL,
      results    TEXT    NOT NULL,
      source     TEXT    NOT NULL DEFAULT 'searxng',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS search_audit (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT    NOT NULL,
      layer        TEXT    NOT NULL,
      query        TEXT    NOT NULL,
      result_count INTEGER NOT NULL DEFAULT 0,
      error        TEXT,
      duration_ms  INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_cache_key    ON search_cache(cache_key);
    CREATE INDEX IF NOT EXISTS idx_cache_expiry ON search_cache(expires_at);
    CREATE INDEX IF NOT EXISTS idx_audit_session ON search_audit(session_id);
  `);

  return _db;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CachedDomain {
  domain: string;
  companyName: string;
}

export interface AuditEntry {
  sessionId: string;
  layer: string;
  query: string;
  resultCount: number;
  error?: string;
  durationMs: number;
}

// ── Cache API ─────────────────────────────────────────────────────────────────

const TTL_7_DAYS = 7 * 24 * 60 * 60; // seconds

export function getCachedDomains(cacheKey: string): CachedDomain[] {
  try {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const row = db
      .prepare("SELECT results FROM search_cache WHERE cache_key = ? AND expires_at > ?")
      .get(cacheKey, now) as { results: string } | undefined;

    if (!row) return [];
    return JSON.parse(row.results) as CachedDomain[];
  } catch (err) {
    console.warn("[SearchCache] getCached failed:", err);
    return [];
  }
}

export function saveCachedDomains(
  cacheKey: string,
  domains: CachedDomain[],
  source = "searxng"
): void {
  try {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      INSERT INTO search_cache (cache_key, results, source, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        results    = excluded.results,
        source     = excluded.source,
        expires_at = excluded.expires_at
    `).run(cacheKey, JSON.stringify(domains), source, now + TTL_7_DAYS);
  } catch (err) {
    console.warn("[SearchCache] saveCache failed:", err);
  }
}

// ── Audit API ─────────────────────────────────────────────────────────────────

export function writeAudit(entry: AuditEntry): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO search_audit (session_id, layer, query, result_count, error, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      entry.sessionId,
      entry.layer,
      entry.query,
      entry.resultCount,
      entry.error ?? null,
      entry.durationMs
    );
  } catch {
    // audit failures must not affect main flow
  }
}

export function getSessionAudit(sessionId: string): AuditEntry[] {
  try {
    const db = getDb();
    return db
      .prepare("SELECT * FROM search_audit WHERE session_id = ? ORDER BY id")
      .all(sessionId) as AuditEntry[];
  } catch {
    return [];
  }
}
