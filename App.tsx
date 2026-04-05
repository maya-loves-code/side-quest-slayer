import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  addEntry,
  completeQuest,
  createQuest,
  getActiveQuest,
  getArchivedQuests,
  getEntriesForQuest,
  getJourneyPair,
  initializeDatabase,
} from "./src/lib/db";
import { scheduleDailyQuestReminder } from "./src/lib/notifications";
import { saveCapturedPhoto } from "./src/lib/storage";
import type { JournalEntry, Quest } from "./src/types";

type Screen = "home" | "trophies";

type JourneyState = {
  first: JournalEntry | null;
  latest: JournalEntry | null;
};

export default function App() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("home");
  const [questTitle, setQuestTitle] = useState("");
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [archivedQuests, setArchivedQuests] = useState<Quest[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [journeyPair, setJourneyPair] = useState<JourneyState>({ first: null, latest: null });

  const hasEnoughForJourney = entries.length >= 2;

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

    await createQuest(questTitle);
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
            setJourneyOpen(false);
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

  const headerLabel = useMemo(() => {
    if (!activeQuest) {
      return "No active quest";
    }

    return `Active Quest: ${activeQuest.title}`;
  }, [activeQuest]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#f55d3e" />
        <Text style={styles.loadingText}>Building your personal proof wall...</Text>
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
            <Text style={styles.cameraLabel}>Raw Viewfinder</Text>
            <Text style={styles.cameraQuestTitle}>{activeQuest?.title}</Text>
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

      <Modal animationType="fade" transparent visible={journeyOpen}>
        <View style={styles.journeyBackdrop}>
          <View style={styles.journeyCard}>
            <Text style={styles.journeyTitle}>The Narrative Bridge</Text>
            <Text style={styles.journeySubtitle}>Day 1 beside your latest proof.</Text>
            <View style={styles.bridgeRow}>
              <View style={styles.bridgePanel}>
                <Text style={styles.bridgeLabel}>Day 1</Text>
                {journeyPair.first ? (
                  <Image source={{ uri: journeyPair.first.imageUri }} style={styles.bridgeImage} />
                ) : (
                  <View style={styles.bridgePlaceholder}>
                    <Text style={styles.placeholderText}>No first photo yet</Text>
                  </View>
                )}
              </View>
              <View style={styles.bridgePanel}>
                <Text style={styles.bridgeLabel}>Latest</Text>
                {journeyPair.latest ? (
                  <Image source={{ uri: journeyPair.latest.imageUri }} style={styles.bridgeImage} />
                ) : (
                  <View style={styles.bridgePlaceholder}>
                    <Text style={styles.placeholderText}>No latest photo yet</Text>
                  </View>
                )}
              </View>
            </View>
            <Pressable onPress={() => setJourneyOpen(false)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Back to scrapbook</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Progress Journal</Text>
          <Text style={styles.title}>Side Quest Slayer</Text>
          <Text style={styles.headerText}>{headerLabel}</Text>
          <Text style={styles.subtleText}>
            Document the unpolished work. Build proof, not performance.
          </Text>
          <View style={styles.topNav}>
            <Pressable onPress={() => setScreen("home")} style={screen === "home" ? styles.tabActive : styles.tab}>
              <Text style={screen === "home" ? styles.tabActiveText : styles.tabText}>Journal</Text>
            </Pressable>
            <Pressable
              onPress={() => setScreen("trophies")}
              style={screen === "trophies" ? styles.tabActive : styles.tab}
            >
              <Text style={screen === "trophies" ? styles.tabActiveText : styles.tabText}>Trophy Room</Text>
            </Pressable>
          </View>
        </View>

        {screen === "home" ? (
          activeQuest ? (
            <>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Daily Proof</Text>
                <Text style={styles.sectionText}>
                  Capture one honest frame of the work. No polish. No filters. Just evidence.
                </Text>
                <Pressable onPress={openCamera} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Open Raw Camera</Text>
                </Pressable>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Scrapbook Grid</Text>
                    <Text style={styles.sectionText}>Your proof wall, newest first.</Text>
                  </View>
                  <Pressable
                    disabled={!hasEnoughForJourney}
                    onPress={() => setJourneyOpen(true)}
                    style={hasEnoughForJourney ? styles.glowButton : styles.glowButtonDisabled}
                  >
                    <Text style={styles.glowButtonText}>See Journey</Text>
                  </Pressable>
                </View>
                {entries.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No proof yet</Text>
                    <Text style={styles.sectionText}>
                      Your first photo becomes the milestone anchor for the story bridge.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={entries}
                    keyExtractor={(item) => item.id.toString()}
                    numColumns={3}
                    scrollEnabled={false}
                    columnWrapperStyle={styles.gridRow}
                    renderItem={({ item }) => (
                      <View style={styles.gridCell}>
                        <Image source={{ uri: item.imageUri }} style={styles.gridImage} />
                      </View>
                    )}
                  />
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
    </SafeAreaView>
  );
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

const palette = {
  paper: "#fff9f0",
  ink: "#1f1a17",
  accent: "#7c3aed",
  accentDark: "#5b21b6",
  blush: "#ffd9cb",
  gold: "#ffc857",
  sky: "#b8f2e6",
  card: "#fff4e2",
  border: "#d8bca6",
  muted: "#6f5d54",
  shadow: "rgba(103, 49, 30, 0.14)",
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  container: {
    padding: 18,
    paddingBottom: 48,
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
    backgroundColor: palette.card,
    borderRadius: 28,
    padding: 20,
    borderWidth: 2,
    borderColor: palette.border,
    shadowColor: palette.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  eyebrow: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: palette.accentDark,
    marginBottom: 8,
    fontWeight: "700",
  },
  title: {
    fontSize: 34,
    color: palette.ink,
    fontWeight: "900",
  },
  headerText: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: "800",
    color: palette.accentDark,
  },
  subtleText: {
    marginTop: 10,
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  topNav: {
    flexDirection: "row",
    marginTop: 18,
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#fff0ea",
    alignItems: "center",
  },
  tabActive: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: palette.accent,
    alignItems: "center",
  },
  tabText: {
    color: palette.accentDark,
    fontWeight: "700",
  },
  tabActiveText: {
    color: "#fff",
    fontWeight: "800",
  },
  onboardingCard: {
    backgroundColor: "#fff6f3",
    borderRadius: 30,
    padding: 20,
    borderWidth: 2,
    borderColor: palette.blush,
    gap: 14,
  },
  sectionCard: {
    backgroundColor: "#fffdf8",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1.5,
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
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: palette.ink,
  },
  primaryButton: {
    backgroundColor: palette.accent,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#ff8f75",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: "#fff1db",
    borderRadius: 16,
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
    backgroundColor: "#fff1ef",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#f6b6a8",
  },
  secondaryDestructiveText: {
    color: palette.accentDark,
    fontSize: 16,
    fontWeight: "900",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "center",
  },
  glowButton: {
    backgroundColor: palette.gold,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: palette.gold,
    shadowOpacity: 0.7,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  glowButtonDisabled: {
    backgroundColor: "#f1dfaa",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
    opacity: 0.55,
  },
  glowButtonText: {
    color: palette.ink,
    fontWeight: "900",
  },
  emptyState: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#fff7ee",
    borderWidth: 1,
    borderColor: "#ecd5c3",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.ink,
    marginBottom: 6,
  },
  gridRow: {
    gap: 8,
  },
  gridCell: {
    flex: 1,
    aspectRatio: 1,
    marginBottom: 8,
  },
  gridImage: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    backgroundColor: "#f5e3d7",
  },
  trophyCard: {
    backgroundColor: "#fff5d6",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#efcd72",
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
  cameraLabel: {
    color: "#fff",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "700",
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
    borderRadius: 24,
    alignItems: "center",
    paddingVertical: 18,
  },
  captureButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },
  journeyBackdrop: {
    flex: 1,
    backgroundColor: "rgba(30, 18, 12, 0.5)",
    justifyContent: "center",
    padding: 18,
  },
  journeyCard: {
    backgroundColor: "#fff9ef",
    borderRadius: 28,
    padding: 18,
    borderWidth: 2,
    borderColor: palette.gold,
    gap: 14,
  },
  journeyTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: palette.ink,
    textAlign: "center",
  },
  journeySubtitle: {
    textAlign: "center",
    color: palette.muted,
    lineHeight: 22,
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
    aspectRatio: 0.85,
    borderRadius: 18,
    backgroundColor: "#f5e3d7",
  },
  bridgePlaceholder: {
    aspectRatio: 0.85,
    borderRadius: 18,
    backgroundColor: "#fff1db",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  placeholderText: {
    textAlign: "center",
    color: palette.muted,
    lineHeight: 20,
  },
});
