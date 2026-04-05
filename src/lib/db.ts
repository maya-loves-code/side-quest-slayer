import * as SQLite from "expo-sqlite";

import type { JournalEntry, Quest } from "../types";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync("side-quest-slayer.db");
  }

  return databasePromise;
}

export async function initializeDatabase() {
  const db = await getDatabase();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS quests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quest_id INTEGER NOT NULL,
      image_uri TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      is_milestone INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (quest_id) REFERENCES quests (id) ON DELETE CASCADE
    );
  `);
}

function mapQuest(row: any): Quest {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
  };
}

function mapEntry(row: any): JournalEntry {
  return {
    id: row.id,
    questId: row.quest_id,
    imageUri: row.image_uri,
    timestamp: row.timestamp,
    isMilestone: row.is_milestone,
  };
}

export async function getActiveQuest() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM quests WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`
  );

  return row ? mapQuest(row) : null;
}

export async function getArchivedQuests() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM quests WHERE status = 'archived' ORDER BY completed_at DESC, started_at DESC`
  );

  return rows.map(mapQuest);
}

export async function createQuest(title: string) {
  const db = await getDatabase();
  const startedAt = new Date().toISOString();

  await db.withExclusiveTransactionAsync(async () => {
    await db.runAsync(`UPDATE quests SET status = 'archived', completed_at = ? WHERE status = 'active'`, startedAt);
    await db.runAsync(
      `INSERT INTO quests (title, status, started_at) VALUES (?, 'active', ?)`,
      title.trim(),
      startedAt
    );
  });
}

export async function completeQuest(questId: number) {
  const db = await getDatabase();
  const completedAt = new Date().toISOString();

  await db.runAsync(
    `UPDATE quests SET status = 'archived', completed_at = ? WHERE id = ?`,
    completedAt,
    questId
  );
}

export async function addEntry(questId: number, imageUri: string, isMilestone = 0) {
  const db = await getDatabase();
  const timestamp = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO entries (quest_id, image_uri, timestamp, is_milestone) VALUES (?, ?, ?, ?)`,
    questId,
    imageUri,
    timestamp,
    isMilestone
  );
}

export async function getEntriesForQuest(questId: number) {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM entries WHERE quest_id = ? ORDER BY timestamp DESC`,
    questId
  );

  return rows.map(mapEntry);
}

export async function getJourneyPair(questId: number) {
  const db = await getDatabase();
  const first = await db.getFirstAsync<any>(
    `SELECT * FROM entries WHERE quest_id = ? ORDER BY timestamp ASC LIMIT 1`,
    questId
  );
  const latest = await db.getFirstAsync<any>(
    `SELECT * FROM entries WHERE quest_id = ? ORDER BY timestamp DESC LIMIT 1`,
    questId
  );

  return {
    first: first ? mapEntry(first) : null,
    latest: latest ? mapEntry(latest) : null,
  };
}
