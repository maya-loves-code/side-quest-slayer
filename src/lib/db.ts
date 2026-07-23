import * as SQLite from "expo-sqlite";

import { createStoredPhotoReference, resolveStoredPhotoUri } from "./storage";
import type { JournalEntry, Quest } from "../types";

const ENTRY_CAPTION_CHARACTER_LIMIT = 280;
const QUEST_TITLE_CHARACTER_LIMIT = 80;
const LAST_OPEN_QUEST_SETTING_KEY = "last_open_quest_id";
const DAILY_REMINDER_ENABLED_SETTING_KEY = "daily_reminder_enabled";
const DAILY_REMINDER_TIME_SETTING_KEY = "daily_reminder_time";
const DAILY_REMINDER_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const DEFAULT_DAILY_REMINDER_TIME = "20:00";

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
    PRAGMA foreign_keys = ON;

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
    imageUri: resolveStoredPhotoUri(row.image_uri),
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
  const savedTitle = title.trim().slice(0, QUEST_TITLE_CHARACTER_LIMIT);

  if (!savedTitle) {
    throw new Error("Quest title is required.");
  }

  const result = await db.runAsync(
    `INSERT INTO quests (title, emoji, status, started_at) VALUES (?, ?, 'active', ?)`,
    savedTitle,
    emoji,
    startedAt
  );

  return getQuestById(result.lastInsertRowId);
}

type DemoQuestInput = {
  title: string;
  emoji: string | null;
  startedAt: string;
} & ({ status: "active"; completedAt?: null } | { status: "archived"; completedAt: string });

export async function createDemoQuest({ title, emoji, status, startedAt, completedAt = null }: DemoQuestInput) {
  const db = await getDatabase();
  const savedTitle = title.trim().slice(0, QUEST_TITLE_CHARACTER_LIMIT);

  if (!savedTitle) {
    throw new Error("Quest title is required.");
  }

  if (status === "archived" && !completedAt) {
    throw new Error("Archived demo quests require a completed date.");
  }

  if (status === "active" && completedAt) {
    throw new Error("Active demo quests cannot have a completed date.");
  }

  const result = await db.runAsync(
    `INSERT INTO quests (title, emoji, status, started_at, completed_at) VALUES (?, ?, ?, ?, ?)`,
    savedTitle,
    emoji,
    status,
    startedAt,
    completedAt
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

export async function getDailyReminderEnabled() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ setting_value: string }>(
    `SELECT setting_value FROM app_settings WHERE setting_key = ?`,
    DAILY_REMINDER_ENABLED_SETTING_KEY
  );

  return row?.setting_value === "true";
}

export async function setDailyReminderEnabled(enabled: boolean) {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`,
    DAILY_REMINDER_ENABLED_SETTING_KEY,
    String(enabled)
  );
}

export async function getDailyReminderTime() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ setting_value: string }>(
    `SELECT setting_value FROM app_settings WHERE setting_key = ?`,
    DAILY_REMINDER_TIME_SETTING_KEY
  );

  const savedTime = row?.setting_value;
  return isDailyReminderTime(savedTime) ? savedTime : DEFAULT_DAILY_REMINDER_TIME;
}

export async function setDailyReminderTime(time: string) {
  if (!isDailyReminderTime(time)) {
    throw new Error("Daily reminder time must be formatted as HH:mm.");
  }

  const db = await getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`,
    DAILY_REMINDER_TIME_SETTING_KEY,
    time
  );
}

function isDailyReminderTime(time: string | undefined): time is string {
  return Boolean(time && DAILY_REMINDER_TIME_PATTERN.test(time));
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

export async function deleteArchivedQuest(questId: number) {
  const db = await getDatabase();

  await db.runAsync(`DELETE FROM quests WHERE id = ? AND status = 'archived'`, questId);
}

export async function addEntry(
  questId: number,
  imageUri: string,
  timestamp: string,
  isMilestone = 0,
  caption = ""
) {
  const db = await getDatabase();
  const savedTimestamp = validateEntryTimestamp(timestamp);
  const savedCaption = caption.trim().slice(0, ENTRY_CAPTION_CHARACTER_LIMIT) || null;
  let entryId: number | null = null;

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      `INSERT INTO entries (quest_id, image_uri, timestamp, is_milestone, caption) VALUES (?, ?, ?, ?, ?)`,
      questId,
      createStoredPhotoReference(imageUri),
      savedTimestamp,
      isMilestone,
      savedCaption
    );
    entryId = result.lastInsertRowId;
    await moveQuestStartEarlier(db, questId, savedTimestamp);
  });

  if (entryId === null) {
    throw new Error("Moment could not be created.");
  }

  return entryId;
}

export async function addDemoEntry({
  questId,
  imageUri,
  timestamp,
  isMilestone = 0,
  caption = "",
}: {
  questId: number;
  imageUri: string;
  timestamp: string;
  isMilestone?: number;
  caption?: string;
}) {
  const db = await getDatabase();
  const savedCaption = caption.trim().slice(0, ENTRY_CAPTION_CHARACTER_LIMIT) || null;

  await db.runAsync(
    `INSERT INTO entries (quest_id, image_uri, timestamp, is_milestone, caption) VALUES (?, ?, ?, ?, ?)`,
    questId,
    createStoredPhotoReference(imageUri),
    timestamp,
    isMilestone,
    savedCaption
  );
}

export async function clearEntryCaption(entryId: number) {
  const db = await getDatabase();

  await db.runAsync(`UPDATE entries SET caption = NULL WHERE id = ?`, entryId);
}

export async function updateEntryTimestamp(entryId: number, timestamp: string) {
  const db = await getDatabase();
  const savedTimestamp = validateEntryTimestamp(timestamp);
  let questId: number | null = null;

  await db.withTransactionAsync(async () => {
    const entry = await db.getFirstAsync<{ quest_id: number; status: string }>(
      `SELECT entries.quest_id, quests.status
       FROM entries
       JOIN quests ON quests.id = entries.quest_id
       WHERE entries.id = ?`,
      entryId
    );

    if (!entry) {
      throw new Error("Moment does not exist.");
    }

    if (entry.status !== "active") {
      throw new Error("Completed quest moments are read-only.");
    }

    questId = entry.quest_id;
    await db.runAsync(`UPDATE entries SET timestamp = ? WHERE id = ?`, savedTimestamp, entryId);
    await moveQuestStartEarlier(db, entry.quest_id, savedTimestamp);
  });

  const updatedEntry = await getEntryById(entryId);

  if (!updatedEntry || questId === null) {
    throw new Error("Moment could not be updated.");
  }

  return updatedEntry;
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

export async function getAllEntries() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(`SELECT * FROM entries ORDER BY timestamp ASC, id ASC`);

  return rows.map(mapEntry);
}

export async function getEntryById(entryId: number) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(`SELECT * FROM entries WHERE id = ?`, entryId);

  return row ? mapEntry(row) : null;
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

export async function deleteAllAppData() {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM entries`);
    await db.runAsync(`DELETE FROM quests`);
    await db.runAsync(`DELETE FROM app_settings`);
  });
}

function validateEntryTimestamp(timestamp: string) {
  const date = new Date(timestamp);

  if (!Number.isFinite(date.getTime())) {
    throw new Error("Moment timestamp is invalid.");
  }

  const today = new Date();
  const selectedDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (selectedDay.getTime() > todayStart.getTime()) {
    throw new Error("Moment date cannot be in the future.");
  }

  return date.toISOString();
}

async function moveQuestStartEarlier(db: SQLite.SQLiteDatabase, questId: number, timestamp: string) {
  await db.runAsync(
    `UPDATE quests
     SET started_at = ?
     WHERE id = ? AND ? < started_at`,
    timestamp,
    questId,
    timestamp
  );
}
