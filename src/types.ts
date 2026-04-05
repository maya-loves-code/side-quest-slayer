export type QuestStatus = "active" | "archived";

export type Quest = {
  id: number;
  title: string;
  status: QuestStatus;
  startedAt: string;
  completedAt: string | null;
};

export type JournalEntry = {
  id: number;
  questId: number;
  imageUri: string;
  timestamp: string;
  isMilestone: number;
};
