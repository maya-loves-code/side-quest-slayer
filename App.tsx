import { CameraView, useCameraPermissions } from "expo-camera";
import type { CameraType } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
import { deleteStoredPhoto, saveCapturedPhoto, saveImportedPhoto } from "./src/lib/storage";
import { palette } from "./src/theme/colors";
import type { JournalEntry, Quest } from "./src/types";

type Screen = "home" | "trophies";

type JourneyState = {
  first: JournalEntry | null;
  latest: JournalEntry | null;
};

type MomentSection = {
  title: string;
  entries: JournalEntry[];
};

const EMOJI_OPTIONS = ["⚔️", "🎨", "💃", "💪", "🎓", "💻", "🎵", "✍️", "📷", "🌱", "🧵", "🛠️", "🎭", "🧠", "🏃‍♀️"];
const TILE_SPARKLES = [
  { id: "top-left", left: 56, top: 50, x: -44, y: -36, scale: 1.05, rotate: "18deg", color: palette.accent },
  { id: "top", left: 74, top: 46, x: -4, y: -50, scale: 0.9, rotate: "-12deg", color: palette.gold },
  { id: "top-right", left: 92, top: 52, x: 42, y: -34, scale: 1, rotate: "24deg", color: palette.accentSoft },
  { id: "left", left: 52, top: 76, x: -52, y: 4, scale: 0.82, rotate: "45deg", color: palette.gold },
  { id: "right", left: 96, top: 76, x: 54, y: 2, scale: 0.88, rotate: "-28deg", color: palette.accent },
  { id: "bottom-left", left: 64, top: 98, x: -30, y: 36, scale: 0.72, rotate: "8deg", color: palette.accentSoft },
  { id: "bottom-right", left: 88, top: 98, x: 30, y: 34, scale: 0.76, rotate: "-18deg", color: palette.gold },
];

export default function App() {
  const cameraRef = useRef<CameraView | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("home");
  const [questTitle, setQuestTitle] = useState("");
  const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [archivedQuests, setArchivedQuests] = useState<Quest[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraType>("back");
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [importingPhoto, setImportingPhoto] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [selectedMoment, setSelectedMoment] = useState<JournalEntry | null>(null);
  const [momentMenuOpen, setMomentMenuOpen] = useState(false);
  const [highlightedMomentId, setHighlightedMomentId] = useState<number | null>(null);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [scrapbookY, setScrapbookY] = useState(0);
  const [journeyPair, setJourneyPair] = useState<JourneyState>({ first: null, latest: null });

  const activeEmoji = activeQuest?.emoji ?? getQuestEmoji(activeQuest?.title ?? "");
  const momentSections = useMemo(() => createMomentSections(entries), [entries]);
  const momentTileWidth = Math.floor((width - 46) / 2);
  const clearCelebration = useCallback(() => setHighlightedMomentId(null), []);

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
      return [];
    }

    const [questEntries, pair] = await Promise.all([
      getEntriesForQuest(quest.id),
      getJourneyPair(quest.id),
    ]);

    setEntries(questEntries);
    setJourneyPair(pair);
    return questEntries;
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
    if (!cameraRef.current || !activeQuest || savingPhoto || importingPhoto) {
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
      await finishMomentAdded();
    } catch (error) {
      console.error(error);
      Alert.alert("Camera error", "That photo did not save. Try one more time.");
    } finally {
      setSavingPhoto(false);
    }
  }

  async function handleImportPhoto() {
    if (!activeQuest || savingPhoto || importingPhoto) {
      return;
    }

    try {
      setImportingPhoto(true);

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert("Camera roll needed", "Allow photo library access to upload a moment from your camera roll.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        selectionLimit: 1,
      });

      if (result.canceled || !result.assets[0]?.uri) {
        return;
      }

      const savedUri = await saveImportedPhoto(result.assets[0].uri);
      await addEntry(activeQuest.id, savedUri, entries.length === 0 ? 1 : 0);
      await finishMomentAdded();
    } catch (error) {
      console.error(error);
      Alert.alert("Upload error", "That photo did not save. Try one more time.");
    } finally {
      setImportingPhoto(false);
    }
  }

  function flipCamera() {
    if (savingPhoto || importingPhoto) {
      return;
    }

    setCameraFacing((facing) => (facing === "back" ? "front" : "back"));
  }

  async function finishMomentAdded() {
    setCameraOpen(false);
    const questEntries = await refreshData();
    const newestMoment = questEntries[0];

    if (newestMoment) {
      setHighlightedMomentId(null);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: Math.max(scrapbookY - 12, 0), animated: true });
      }, 150);
      setTimeout(() => {
        setHighlightedMomentId(newestMoment.id);
        setCelebrationKey((key) => key + 1);
      }, 650);
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

    setCameraFacing("back");
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
          <CameraView ref={cameraRef} facing={cameraFacing} style={StyleSheet.absoluteFill} />
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraHeader}>
              <Text style={styles.cameraQuestTitle}>
                {activeEmoji} {activeQuest?.title}
              </Text>
              <Pressable
                onPress={() => setCameraOpen(false)}
                style={styles.cameraCloseButton}
                accessibilityLabel="Close camera"
              >
                <Text style={styles.cameraCloseText}>×</Text>
              </Pressable>
            </View>
            <View style={styles.cameraActions}>
              <View style={styles.cameraControlBar}>
                <Pressable
                  onPress={handleImportPhoto}
                  style={savingPhoto || importingPhoto ? styles.cameraSideControlDisabled : styles.cameraSideControl}
                  accessibilityLabel="Upload photo from camera roll"
                  disabled={savingPhoto || importingPhoto}
                >
                  <Text style={styles.cameraSideIcon}>🖼️</Text>
                </Pressable>

                <Pressable
                  disabled={savingPhoto || importingPhoto}
                  onPress={handleCapturePhoto}
                  style={savingPhoto || importingPhoto ? styles.shutterButtonDisabled : styles.shutterButton}
                  accessibilityLabel="Take photo"
                >
                  <View style={styles.shutterButtonInner} />
                </Pressable>

                <Pressable
                  onPress={flipCamera}
                  style={savingPhoto || importingPhoto ? styles.cameraSideControlDisabled : styles.cameraSideControl}
                  accessibilityLabel="Switch camera"
                  disabled={savingPhoto || importingPhoto}
                >
                  <Text style={styles.cameraSideIcon}>↻</Text>
                </Pressable>
              </View>
              <View
                style={styles.cameraStatusWrap}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Text style={styles.cameraStatusText}>{savingPhoto ? "Saving..." : importingPhoto ? "Opening..." : " "}</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={emojiPickerOpen}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEmojiPickerOpen(false)}>
          <Pressable style={styles.emojiPickerCard}>
            <Text style={styles.modalTitle}>Choose An Emoji</Text>
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
            <Pressable onPress={() => setMomentMenuOpen((isOpen) => !isOpen)} style={styles.momentIconButton}>
              <Text style={styles.momentDots}>...</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMomentMenuOpen(false);
                setSelectedMoment(null);
              }}
              style={styles.momentCloseButton}
              accessibilityLabel="Close moment"
            >
              <Text style={styles.momentCloseText}>×</Text>
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

      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.container}>
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
                <Text style={styles.sectionTitle}>From Then to Now</Text>
                <View style={styles.bridgeRow}>
                  <JourneyPanel label="First" entry={journeyPair.first} />
                  <JourneyPanel label="Latest" entry={journeyPair.latest} />
                </View>
              </View>

              <View
                onLayout={(event) => setScrapbookY(event.nativeEvent.layout.y)}
                style={styles.scrapbookArea}
              >
                <Text style={styles.sectionTitle}>Your Moments</Text>
                {entries.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No moments yet</Text>
                    <Text style={styles.sectionText}>Your first photo will start the record.</Text>
                  </View>
                ) : (
                  <View style={styles.momentSections}>
                    {momentSections.map((section) => (
                      <View key={section.title} style={styles.momentSection}>
                        <Text style={styles.momentSectionTitle}>{section.title}</Text>
                        <View style={styles.momentGrid}>
                          {section.entries.map((item, index) => (
                            <MomentTile
                              key={item.id}
                              item={item}
                              index={index}
                              isHighlighted={item.id === highlightedMomentId}
                              tileWidth={momentTileWidth}
                              onPress={() => {
                                setMomentMenuOpen(false);
                                setSelectedMoment(item);
                              }}
                            />
                          ))}
                        </View>
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
      {highlightedMomentId !== null && screen === "home" ? (
        <CelebrationOverlay key={celebrationKey} onDone={clearCelebration} />
      ) : null}
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
  isHighlighted,
  tileWidth,
  onPress,
}: {
  item: JournalEntry;
  index: number;
  isHighlighted: boolean;
  tileWidth: number;
  onPress: () => void;
}) {
  const highlightProgress = useRef(new Animated.Value(0)).current;
  const isTall = index % 4 === 0;

  useEffect(() => {
    if (!isHighlighted) {
      highlightProgress.setValue(0);
      return;
    }

    highlightProgress.setValue(0);
    Animated.timing(highlightProgress, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [highlightProgress, isHighlighted]);

  const scale = highlightProgress.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [1, 1.06, 1],
  });
  const glowOpacity = highlightProgress.interpolate({
    inputRange: [0, 0.28, 1],
    outputRange: [0, 0.85, 0],
  });
  const sparkleOpacity = highlightProgress.interpolate({
    inputRange: [0, 0.16, 0.78, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.momentTile,
        isTall ? styles.momentTileTall : styles.momentTileSquare,
        { width: tileWidth, transform: [{ scale }] },
      ]}
    >
      <Pressable onPress={onPress} style={styles.momentTileButton}>
        <Image source={{ uri: item.imageUri }} style={styles.momentTileImage} />
        <Animated.View pointerEvents="none" style={[styles.momentTileGlow, { opacity: glowOpacity }]} />
        {isHighlighted ? (
          <Animated.View pointerEvents="none" style={[styles.tileSparkleField, { opacity: sparkleOpacity }]}>
            {TILE_SPARKLES.map((sparkle) => {
              const translateY = highlightProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, sparkle.y],
              });
              const translateX = highlightProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, sparkle.x],
              });
              const sparkleScale = highlightProgress.interpolate({
                inputRange: [0, 0.35, 1],
                outputRange: [0.4, sparkle.scale, 0.65],
              });

              return (
                <Animated.View
                  key={sparkle.id}
                  style={[
                    styles.sparkle,
                    {
                      backgroundColor: sparkle.color,
                      left: sparkle.left,
                      top: sparkle.top,
                      transform: [
                        { translateX },
                        { translateY },
                        { scale: sparkleScale },
                        { rotate: sparkle.rotate },
                      ],
                    },
                  ]}
                />
              );
            })}
          </Animated.View>
        ) : null}
        <Text style={styles.dateTag}>{formatShortDate(item.timestamp)}</Text>
      </Pressable>
    </Animated.View>
  );
}

function CelebrationOverlay({ onDone }: { onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const holdProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    holdProgress.setValue(0);
    Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(holdProgress, {
        toValue: 1,
        duration: 450,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => onDone());
  }, [holdProgress, onDone, progress]);

  const overlayOpacity = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 1, 1],
  });
  const toastTranslate = progress.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [14, 0, 0],
  });
  const toastScale = progress.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0.96, 1, 1],
  });
  const toastExitOpacity = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const toastExitTranslate = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.celebrationOverlay, { opacity: Animated.multiply(overlayOpacity, toastExitOpacity) }]}>
      <Animated.View
        style={[
          styles.celebrationToast,
          { transform: [{ translateY: Animated.add(toastTranslate, toastExitTranslate) }, { scale: toastScale }] },
        ]}
      >
        <Text style={styles.celebrationToastText}>Moment captured</Text>
      </Animated.View>
    </Animated.View>
  );
}

function createMomentSections(entries: JournalEntry[]) {
  const sortedEntries = [...entries].sort(
    (first, second) => new Date(second.timestamp).getTime() - new Date(first.timestamp).getTime()
  );
  const sections: MomentSection[] = [];
  const sectionByTitle = new Map<string, MomentSection>();

  sortedEntries.forEach((entry) => {
    const title = getMomentSectionTitle(entry.timestamp);
    let section = sectionByTitle.get(title);

    if (!section) {
      section = { title, entries: [] };
      sectionByTitle.set(title, section);
      sections.push(section);
    }

    section.entries.push(entry);
  });

  return sections;
}

function getMomentSectionTitle(dateString: string) {
  const momentDate = new Date(dateString);
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);
  const thisWeekStart = addDays(today, -6);
  const momentDay = startOfDay(momentDate);

  if (momentDay.getTime() === today.getTime()) {
    return "TODAY";
  }

  if (momentDay.getTime() === yesterday.getTime()) {
    return "YESTERDAY";
  }

  if (momentDay >= thisWeekStart) {
    return "THIS WEEK";
  }

  if (momentDay.getFullYear() === today.getFullYear()) {
    return momentDate.toLocaleDateString(undefined, { month: "long" }).toUpperCase();
  }

  return String(momentDay.getFullYear());
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getQuestEmoji(title: string) {
  const normalizedTitle = title.toLowerCase();

  if (/\b(paint|painter|art|artist|draw|drawing|sketch|design)\b/.test(normalizedTitle)) {
    return "🎨";
  }

  if (/\b(dance|dancer|ballet|choreo)\b/.test(normalizedTitle)) {
    return "💃";
  }

  if (/\b(act|acting|actor|actress|theater|theatre|drama|audition|monologue)\b/.test(normalizedTitle)) {
    return "🎭";
  }

  if (/\b(run|runner|running|marathon|race|jog|jogging)\b/.test(normalizedTitle)) {
    return "🏃‍♀️";
  }

  if (/\b(gym|fitness|workout|lift|strength)\b/.test(normalizedTitle)) {
    return "💪";
  }

  if (/\b(school|college|study|student|graduate|degree|class)\b/.test(normalizedTitle)) {
    return "🎓";
  }

  if (/\b(learn|learning|read|reading|books|brain)\b/.test(normalizedTitle)) {
    return "🧠";
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
  cameraHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  cameraCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraCloseText: {
    color: "#fff",
    fontSize: 30,
    lineHeight: 32,
    fontWeight: "500",
  },
  cameraQuestTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
  },
  cameraActions: {
    gap: 10,
    alignItems: "center",
  },
  cameraControlBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  cameraSideControl: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraSideControlDisabled: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.58,
  },
  cameraSideIcon: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255, 255, 255, 0.36)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.86)",
  },
  shutterButtonDisabled: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255, 255, 255, 0.24)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.62)",
    opacity: 0.68,
  },
  shutterButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
  },
  cameraStatusWrap: {
    minHeight: 18,
  },
  cameraStatusText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
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
    width: 44,
    height: 44,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  momentCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  momentCloseText: {
    color: "#fff",
    fontSize: 30,
    lineHeight: 32,
    fontWeight: "500",
  },
  momentDots: {
    color: "#fff",
    fontSize: 18,
    lineHeight: 20,
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
    left: 18,
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
  momentSections: {
    gap: 18,
  },
  momentSection: {
    gap: 8,
  },
  momentSectionTitle: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    opacity: 0.78,
  },
  momentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  momentTile: {
    overflow: "visible",
    borderRadius: 8,
    backgroundColor: palette.panel,
    shadowColor: palette.shadow,
    shadowOpacity: 0.42,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  momentTileButton: {
    flex: 1,
    borderRadius: 8,
  },
  momentTileGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(124, 58, 237, 0.18)",
    borderWidth: 2,
    borderColor: "rgba(245, 192, 97, 0.8)",
    borderRadius: 8,
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
    borderRadius: 8,
    resizeMode: "cover",
    backgroundColor: palette.panel,
  },
  dateTag: {
    position: "absolute",
    left: 8,
    bottom: 7,
    backgroundColor: "rgba(40, 33, 48, 0.56)",
    color: "#fff",
    borderRadius: 6,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "800",
  },
  celebrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  tileSparkleField: {
    ...StyleSheet.absoluteFillObject,
  },
  sparkle: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  celebrationToast: {
    position: "absolute",
    bottom: 116,
    backgroundColor: palette.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: palette.shadowStrong,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  celebrationToastText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
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
