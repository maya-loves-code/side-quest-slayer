import { NativeModules, Platform } from "react-native";

import type { JournalEntry } from "../types";

type WidgetDataBridge = {
  sync(entries: Array<Pick<JournalEntry, "id" | "questId" | "imageUri" | "timestamp">>): Promise<void>;
};

const widgetDataBridge = NativeModules.WidgetDataBridge as WidgetDataBridge | undefined;
let lastSuccessfulSyncSignature: string | null = null;

export async function syncWidgetMemories(entries: JournalEntry[]) {
  if (Platform.OS !== "ios" || !widgetDataBridge?.sync) {
    return;
  }

  const widgetEntries = entries.map(({ id, questId, imageUri, timestamp }) => ({
    id,
    questId,
    imageUri,
    timestamp,
  }));
  const syncSignature = JSON.stringify(widgetEntries);

  if (syncSignature === lastSuccessfulSyncSignature) {
    return;
  }

  try {
    await widgetDataBridge.sync(widgetEntries);
    lastSuccessfulSyncSignature = syncSignature;
  } catch (error) {
    console.warn("Could not refresh Quest Memories widget", error);
  }
}
