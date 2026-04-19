import * as SQLite from "expo-sqlite";

import type { JournalEntry, Quest } from "../types";

const ENTRY_CAPTION_CHARACTER_LIMIT = 180;
const LAST_OPEN_QUEST_SETTING_KEY = "last_open_quest_id";

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
      emoji TEXT,
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
      caption TEXT,
      FOREIGN KEY (quest_id) REFERENCES quests (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL
    );
  `);

  const questColumns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(quests)`);
  const hasEmojiColumn = questColumns.some((column) => column.name === "emoji");

  if (!hasEmojiColumn) {
    await db.execAsync(`ALTER TABLE quests ADD COLUMN emoji TEXT;`);
  }

  const entryColumns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(entries)`);
  const hasCaptionColumn = entryColumns.some((column) => column.name === "caption");

  if (!hasCaptionColumn) {
    await db.execAsync(`ALTER TABLE entries ADD COLUMN caption TEXT;`);
  }
}

function mapQuest(row: any): Quest {
  return {
    id: row.id,
    title: row.title,
    emoji: row.emoji ?? null,
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
    caption: row.caption ?? null,
  };
}

export async function getActiveQuests() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM quests WHERE status = 'active' ORDER BY started_at DESC, id DESC`
  );

  return rows.map(mapQuest);
}

export async function getQuestById(questId: number) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(`SELECT * FROM quests WHERE id = ?`, questId);

  return row ? mapQuest(row) : null;
}

export async function getArchivedQuests() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM quests WHERE status = 'archived' ORDER BY completed_at DESC, started_at DESC`
  );

  return rows.map(mapQuest);
}

export async function createQuest(title: string, emoji: string | null = null) {
  const db = await getDatabase();
  const startedAt = new Date().toISOString();

  const result = await db.runAsync(
    `INSERT INTO quests (title, emoji, status, started_at) VALUES (?, ?, 'active', ?)`,
    title.trim(),
    emoji,
    startedAt
  );

  return getQuestById(result.lastInsertRowId);
}

export async function getLastOpenQuestId() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ setting_value: string }>(
    `SELECT setting_value FROM app_settings WHERE setting_key = ?`,
    LAST_OPEN_QUEST_SETTING_KEY
  );
  const questId = Number(row?.setting_value);

  return Number.isInteger(questId) && questId > 0 ? questId : null;
}

export async function setLastOpenQuestId(questId: number) {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`,
    LAST_OPEN_QUEST_SETTING_KEY,
    String(questId)
  );
}

export async function updateQuestEmoji(questId: number, emoji: string) {
  const db = await getDatabase();

  await db.runAsync(`UPDATE quests SET emoji = ? WHERE id = ?`, emoji, questId);
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

export async function addEntry(questId: number, imageUri: string, isMilestone = 0, caption = "") {
  const db = await getDatabase();
  const timestamp = new Date().toISOString();
  const savedCaption = caption.trim().slice(0, ENTRY_CAPTION_CHARACTER_LIMIT) || null;

  await db.runAsync(
    `INSERT INTO entries (quest_id, image_uri, timestamp, is_milestone, caption) VALUES (?, ?, ?, ?, ?)`,
    questId,
    imageUri,
    timestamp,
    isMilestone,
    savedCaption
  );
}

export async function clearEntryCaption(entryId: number) {
  const db = await getDatabase();

  await db.runAsync(`UPDATE entries SET caption = NULL WHERE id = ?`, entryId);
}

export async function deleteEntry(entryId: number) {
  const db = await getDatabase();

  await db.runAsync(`DELETE FROM entries WHERE id = ?`, entryId);
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
