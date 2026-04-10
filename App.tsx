import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import {
  addEntry,
  completeQuest,
  createQuest,
  deleteEntry,
  getActiveQuest,
  getArchivedQuests,
  getEntriesForQuest,
  getJourneyPair,
  initializeDatabase,
  updateQuestEmoji,
} from "./src/lib/db";
import { scheduleDailyQuestReminder } from "./src/lib/notifications";
import { deleteStoredPhoto, saveCapturedPhoto } from "./src/lib/storage";
import { palette } from "./src/theme/colors";
import type { JournalEntry, Quest } from "./src/types";

type Screen = "home" | "trophies";

type JourneyState = {
  first: JournalEntry | null;
  latest: JournalEntry | null;
};

const EMOJI_OPTIONS = ["⚔️", "🎨", "💃", "💪", "🎓", "💻", "🎵", "✍️", "📷", "🌱", "🧵", "🛠️"];

export default function App() {
  const cameraRef = useRef<CameraView | null>(null);
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("home");
  const [questTitle, setQuestTitle] = useState("");
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [archivedQuests, setArchivedQuests] = useState<Quest[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [selectedMoment, setSelectedMoment] = useState<JournalEntry | null>(null);
  const [momentMenuOpen, setMomentMenuOpen] = useState(false);
  const [journeyPair, setJourneyPair] = useState<JourneyState>({ first: null, latest: null });

  const activeEmoji = activeQuest?.emoji ?? getQuestEmoji(activeQuest?.title ?? "");
  const momentColumns = useMemo(() => createMomentColumns(entries, width >= 720 ? 3 : 2), [entries, width]);

  useEffect(() => {
    void bootstrapApp();
  }, []);

  async function bootstrapApp() {
    try {
      await initializeDatabase();
      await scheduleDailyQuestReminder();
      await refreshData();
    } catch (error) {
      console.error(error);
      Alert.alert("Setup error", "Side Quest Slayer could not finish setting up local storage.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshData() {
    const quest = await getActiveQuest();
    const trophies = await getArchivedQuests();
    setActiveQuest(quest);
    setArchivedQuests(trophies);

    if (!quest) {
      setEntries([]);
      setJourneyPair({ first: null, latest: null });
      return;
    }

    const [questEntries, pair] = await Promise.all([
      getEntriesForQuest(quest.id),
      getJourneyPair(quest.id),
    ]);

    setEntries(questEntries);
    setJourneyPair(pair);
  }

  async function handleCreateQuest() {
    if (!questTitle.trim()) {
      Alert.alert("Name your quest", "Give your goal a name before you commit.");
      return;
    }

    await createQuest(questTitle, getQuestEmoji(questTitle));
    setQuestTitle("");
    await refreshData();
  }

  async function handleCapturePhoto() {
    if (!cameraRef.current || !activeQuest || savingPhoto) {
      return;
    }

    try {
      setSavingPhoto(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });

      if (!photo?.uri) {
        return;
      }

      const savedUri = await saveCapturedPhoto(photo.uri);
      await addEntry(activeQuest.id, savedUri, entries.length === 0 ? 1 : 0);
      setCameraOpen(false);
      await refreshData();
    } catch (error) {
      console.error(error);
      Alert.alert("Camera error", "That photo did not save. Try one more time.");
    } finally {
      setSavingPhoto(false);
    }
  }

  async function handleCompleteQuest() {
    if (!activeQuest) {
      return;
    }

    Alert.alert(
      "Complete quest?",
      "This moves your current quest into the Trophy Room and clears the slate for the next one.",
      [
        { text: "Keep going", style: "cancel" },
        {
          text: "Complete Quest",
          style: "destructive",
          onPress: async () => {
            await completeQuest(activeQuest.id);
            await refreshData();
          },
        },
      ]
    );
  }

  async function openCamera() {
    if (!permission?.granted) {
      const result = await requestPermission();

      if (!result.granted) {
        Alert.alert("Camera needed", "You need camera access to create daily proof entries.");
        return;
      }
    }

    setCameraOpen(true);
  }

  async function handleEmojiSelect(emoji: string) {
    if (!activeQuest) {
      return;
    }

    await updateQuestEmoji(activeQuest.id, emoji);
    setEmojiPickerOpen(false);
    await refreshData();
  }

  async function handleDeleteSelectedMoment() {
    if (!selectedMoment) {
      return;
    }

    const moment = selectedMoment;
    setSelectedMoment(null);
    setMomentMenuOpen(false);
    await deleteEntry(moment.id);
    await deleteStoredPhoto(moment.imageUri);
    await refreshData();
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.loadingText}>Loading your moments...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <Modal animationType="slide" visible={cameraOpen}>
        <View style={styles.cameraScreen}>
          <CameraView ref={cameraRef} facing="back" style={StyleSheet.absoluteFill} />
          <View style={styles.cameraOverlay}>
            <Text style={styles.cameraQuestTitle}>
              {activeEmoji} {activeQuest?.title}
            </Text>
            <View style={styles.cameraActions}>
              <Pressable onPress={() => setCameraOpen(false)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Close</Text>
              </Pressable>
              <Pressable onPress={handleCapturePhoto} style={styles.captureButton}>
                <Text style={styles.captureButtonText}>
                  {savingPhoto ? "Saving..." : "Take Daily Proof"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={emojiPickerOpen}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEmojiPickerOpen(false)}>
          <Pressable style={styles.emojiPickerCard}>
            <Text style={styles.modalTitle}>Choose a quest mark</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map((emoji) => (
                <Pressable key={emoji} onPress={() => handleEmojiSelect(emoji)} style={styles.emojiChoice}>
                  <Text style={styles.emojiChoiceText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="fade" visible={!!selectedMoment}>
        <View style={styles.momentScreen}>
          <View style={styles.momentTopBar}>
            <Pressable onPress={() => setSelectedMoment(null)} style={styles.momentIconButton}>
              <Text style={styles.momentIconText}>Close</Text>
            </Pressable>
            <Pressable onPress={() => setMomentMenuOpen((isOpen) => !isOpen)} style={styles.momentIconButton}>
              <Text style={styles.momentDots}>...</Text>
            </Pressable>
          </View>
          {selectedMoment ? <Image source={{ uri: selectedMoment.imageUri }} style={styles.momentImage} /> : null}
          <Text style={styles.momentTimestamp}>{formatTimestamp(selectedMoment?.timestamp ?? null)}</Text>
          {momentMenuOpen ? (
            <Pressable onPress={handleDeleteSelectedMoment} style={styles.deleteMomentButton}>
              <Text style={styles.deleteMomentText}>Delete moment</Text>
            </Pressable>
          ) : null}
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.title}>Side Quest Slayer</Text>
        </View>

        {screen === "home" ? (
          activeQuest ? (
            <>
              <View style={styles.questCard}>
                <View style={styles.questHeader}>
                  <Pressable onPress={() => setEmojiPickerOpen(true)} style={styles.questEmojiButton}>
                    <Text style={styles.questEmoji}>{activeEmoji}</Text>
                  </Pressable>
                  <View style={styles.questTitleWrap}>
                    <Text style={styles.questTitle}>{activeQuest.title}</Text>
                    <Text style={styles.momentCount}>
                      {entries.length} {entries.length === 1 ? "moment" : "moments"} captured so far
                    </Text>
                  </View>
                </View>
                <Pressable onPress={openCamera} style={styles.cameraButton} accessibilityLabel="Open camera">
                  <Text style={styles.cameraButtonIcon}>📷</Text>
                  <Text style={styles.cameraButtonText}>Capture moment</Text>
                </Pressable>
              </View>

              <View style={styles.journeyCard}>
                <Text style={styles.sectionTitle}>Your Journey So Far</Text>
                <View style={styles.bridgeRow}>
                  <JourneyPanel label="First" entry={journeyPair.first} />
                  <JourneyPanel label="Latest" entry={journeyPair.latest} />
                </View>
              </View>

              <View style={styles.scrapbookArea}>
                {entries.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No moments yet</Text>
                    <Text style={styles.sectionText}>Your first photo will start the record.</Text>
                  </View>
                ) : (
                  <View style={styles.masonryGrid}>
                    {momentColumns.map((column, columnIndex) => (
                      <View key={columnIndex} style={styles.masonryColumn}>
                        {column.map((item, index) => (
                          <MomentTile
                            key={item.id}
                            item={item}
                            index={index + columnIndex}
                            onPress={() => {
                              setMomentMenuOpen(false);
                              setSelectedMoment(item);
                            }}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Quest Controls</Text>
                <Text style={styles.sectionText}>
                  When the journey is complete, archive the quest and start fresh.
                </Text>
                <Pressable onPress={handleCompleteQuest} style={styles.secondaryDestructiveButton}>
                  <Text style={styles.secondaryDestructiveText}>Complete Quest</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.onboardingCard}>
              <Text style={styles.sectionTitle}>The Singular Commitment</Text>
              <Text style={styles.sectionText}>
                Choose one high-stakes identity to chase. Side Quest Slayer only allows one active quest at a time.
              </Text>
              <TextInput
                value={questTitle}
                onChangeText={setQuestTitle}
                placeholder="College Graduate, Professional Dancer, Dream Job..."
                placeholderTextColor="#8b6f6a"
                style={styles.input}
              />
              <Pressable onPress={handleCreateQuest} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Commit To This Quest</Text>
              </Pressable>
            </View>
          )
        ) : (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Trophy Room</Text>
            <Text style={styles.sectionText}>Finished quests live here as proof of follow-through.</Text>
            {archivedQuests.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No trophies yet</Text>
                <Text style={styles.sectionText}>Complete a quest and it will appear here.</Text>
              </View>
            ) : (
              archivedQuests.map((quest) => (
                <View key={quest.id} style={styles.trophyCard}>
                  <Text style={styles.trophyTitle}>{quest.title}</Text>
                  <Text style={styles.trophyMeta}>
                    Started {formatDate(quest.startedAt)} • Completed {formatDate(quest.completedAt)}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
      <View style={styles.bottomNav}>
        <Pressable onPress={() => setScreen("home")} style={screen === "home" ? styles.navItemActive : styles.navItem}>
          <Text style={screen === "home" ? styles.navIconActive : styles.navIcon}>📓</Text>
          <Text style={screen === "home" ? styles.navTextActive : styles.navText}>Journal</Text>
        </Pressable>
        <Pressable
          onPress={() => setScreen("trophies")}
          style={screen === "trophies" ? styles.navItemActive : styles.navItem}
        >
          <Text style={screen === "trophies" ? styles.navIconActive : styles.navIcon}>🏆</Text>
          <Text style={screen === "trophies" ? styles.navTextActive : styles.navText}>Trophy Room</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function JourneyPanel({ label, entry }: { label: string; entry: JournalEntry | null }) {
  return (
    <View style={styles.bridgePanel}>
      <Text style={styles.bridgeLabel}>{label}</Text>
      {entry ? (
        <View style={styles.bridgeImageWrap}>
          <Image source={{ uri: entry.imageUri }} style={styles.bridgeImage} />
          <Text style={styles.dateTag}>{formatShortDate(entry.timestamp)}</Text>
        </View>
      ) : (
        <View style={styles.bridgePlaceholder}>
          <Text style={styles.placeholderText}>Waiting for a moment</Text>
        </View>
      )}
    </View>
  );
}

function MomentTile({
  item,
  index,
  onPress,
}: {
  item: JournalEntry;
  index: number;
  onPress: () => void;
}) {
  const isTall = index % 4 === 1 || index % 4 === 2;
  const rotation = index % 3 === 0 ? "-1deg" : index % 3 === 1 ? "1.25deg" : "0.5deg";
  const overlap = index % 5 === 0 ? -8 : 0;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.momentTile,
        isTall ? styles.momentTileTall : styles.momentTileSquare,
        { marginTop: overlap, transform: [{ rotate: rotation }] },
      ]}
    >
      <Image source={{ uri: item.imageUri }} style={styles.momentTileImage} />
      <Text style={styles.dateTag}>{formatShortDate(item.timestamp)}</Text>
    </Pressable>
  );
}

function createMomentColumns(entries: JournalEntry[], columnCount: number) {
  const columns = Array.from({ length: columnCount }, () => [] as JournalEntry[]);

  entries.forEach((entry, index) => {
    columns[index % columnCount].push(entry);
  });

  return columns;
}

function getQuestEmoji(title: string) {
  const normalizedTitle = title.toLowerCase();

  if (/\b(paint|painter|art|artist|draw|drawing|sketch|design)\b/.test(normalizedTitle)) {
    return "🎨";
  }

  if (/\b(dance|dancer|ballet|choreo)\b/.test(normalizedTitle)) {
    return "💃";
  }

  if (/\b(gym|fitness|workout|lift|run|runner|strength)\b/.test(normalizedTitle)) {
    return "💪";
  }

  if (/\b(school|college|study|student|graduate|degree|class)\b/.test(normalizedTitle)) {
    return "🎓";
  }

  if (/\b(code|coding|app|developer|software|program)\b/.test(normalizedTitle)) {
    return "💻";
  }

  if (/\b(music|song|sing|guitar|piano|album)\b/.test(normalizedTitle)) {
    return "🎵";
  }

  if (/\b(write|writer|writing|book|novel|journal)\b/.test(normalizedTitle)) {
    return "✍️";
  }

  return "⚔️";
}

function formatDate(dateString: string | null) {
  if (!dateString) {
    return "in progress";
  }

  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatTimestamp(dateString: string | null) {
  if (!dateString) {
    return "";
  }

  return new Date(dateString).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  container: {
    padding: 18,
    paddingBottom: 132,
    gap: 18,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.paper,
    gap: 14,
  },
  loadingText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "600",
  },
  heroCard: {
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  title: {
    fontSize: 24,
    color: palette.ink,
    fontWeight: "900",
  },
  onboardingCard: {
    backgroundColor: palette.card,
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 14,
  },
  sectionCard: {
    backgroundColor: palette.card,
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: palette.ink,
  },
  sectionText: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: palette.ink,
  },
  primaryButton: {
    backgroundColor: palette.accent,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: palette.card,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryDestructiveButton: {
    backgroundColor: palette.dangerSoft,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.dangerBorder,
  },
  secondaryDestructiveText: {
    color: palette.danger,
    fontSize: 16,
    fontWeight: "900",
  },
  emptyState: {
    borderRadius: 8,
    padding: 18,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.border,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.ink,
    marginBottom: 6,
  },
  trophyCard: {
    backgroundColor: "#fff8d9",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.gold,
    marginTop: 10,
  },
  trophyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: palette.ink,
  },
  trophyMeta: {
    color: palette.muted,
    marginTop: 6,
    lineHeight: 20,
  },
  cameraScreen: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 40,
    backgroundColor: "rgba(16, 8, 3, 0.24)",
  },
  cameraQuestTitle: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
    maxWidth: "80%",
  },
  cameraActions: {
    gap: 12,
  },
  captureButton: {
    backgroundColor: palette.accent,
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 18,
  },
  captureButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: palette.backdrop,
    justifyContent: "center",
    padding: 18,
  },
  emojiPickerCard: {
    backgroundColor: palette.card,
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: palette.ink,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  emojiChoice: {
    width: 54,
    height: 54,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.border,
  },
  emojiChoiceText: {
    fontSize: 28,
  },
  momentScreen: {
    flex: 1,
    backgroundColor: palette.dark,
    padding: 18,
    justifyContent: "center",
    gap: 16,
  },
  momentTopBar: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 56,
    zIndex: 2,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  momentIconButton: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  momentIconText: {
    color: "#fff",
    fontWeight: "800",
  },
  momentDots: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },
  momentImage: {
    width: "100%",
    height: "72%",
    borderRadius: 8,
    resizeMode: "contain",
  },
  momentTimestamp: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
  },
  deleteMomentButton: {
    position: "absolute",
    right: 18,
    top: 104,
    backgroundColor: palette.dangerSoft,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  deleteMomentText: {
    color: palette.danger,
    fontWeight: "900",
  },
  questCard: {
    backgroundColor: palette.card,
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 18,
    shadowColor: palette.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  questHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  questEmojiButton: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.border,
  },
  questEmoji: {
    fontSize: 40,
  },
  questTitleWrap: {
    flex: 1,
    gap: 6,
  },
  questTitle: {
    color: palette.ink,
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 36,
  },
  momentCount: {
    color: palette.muted,
    fontSize: 15,
    fontWeight: "700",
  },
  cameraButton: {
    alignSelf: "stretch",
    minHeight: 54,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: palette.accent,
    borderWidth: 1,
    borderColor: palette.accentDark,
  },
  cameraButtonIcon: {
    fontSize: 21,
  },
  cameraButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  journeyCard: {
    backgroundColor: "#fff8d9",
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: palette.gold,
    gap: 14,
  },
  bridgeRow: {
    flexDirection: "row",
    gap: 12,
  },
  bridgePanel: {
    flex: 1,
    gap: 8,
  },
  bridgeLabel: {
    textAlign: "center",
    fontWeight: "800",
    color: palette.accentDark,
  },
  bridgeImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: palette.panel,
  },
  bridgeImageWrap: {
    width: "100%",
    aspectRatio: 0.85,
  },
  bridgePlaceholder: {
    aspectRatio: 0.85,
    borderRadius: 8,
    backgroundColor: "#f3f0df",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  placeholderText: {
    textAlign: "center",
    color: palette.muted,
    lineHeight: 20,
  },
  scrapbookArea: {
    gap: 14,
  },
  masonryGrid: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 8,
  },
  masonryColumn: {
    flex: 1,
    gap: 10,
  },
  momentTile: {
    overflow: "hidden",
    borderRadius: 8,
    borderWidth: 4,
    borderColor: "#fff",
    backgroundColor: palette.card,
    shadowColor: palette.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  momentTileSquare: {
    aspectRatio: 1,
  },
  momentTileTall: {
    aspectRatio: 0.76,
  },
  momentTileImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    backgroundColor: palette.panel,
  },
  dateTag: {
    position: "absolute",
    right: 7,
    bottom: 7,
    backgroundColor: "rgba(255, 255, 255, 0.86)",
    color: palette.ink,
    borderRadius: 6,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "800",
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 8,
    backgroundColor: palette.card,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 18,
    shadowColor: palette.shadowStrong,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -6 },
    elevation: 10,
  },
  navItem: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    gap: 4,
  },
  navItemActive: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    gap: 4,
    backgroundColor: palette.accent,
  },
  navIcon: {
    fontSize: 20,
    opacity: 0.72,
  },
  navIconActive: {
    fontSize: 20,
  },
  navText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  navTextActive: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
});
