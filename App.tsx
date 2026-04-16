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
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  clearEntryCaption,
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
const CAPTION_CHARACTER_LIMIT = 180;
const TILE_SPARKLES = [
  { id: "top-left", left: 56, top: 50, x: -44, y: -36, scale: 1.05, rotate: "18deg", color: palette.accent },
  { id: "top", left: 74, top: 46, x: -4, y: -50, scale: 0.9, rotate: "-12deg", color: palette.accentSoft },
  { id: "top-right", left: 92, top: 52, x: 42, y: -34, scale: 1, rotate: "24deg", color: palette.accentSoft },
  { id: "left", left: 52, top: 76, x: -52, y: 4, scale: 0.82, rotate: "45deg", color: palette.accent },
  { id: "right", left: 96, top: 76, x: 54, y: 2, scale: 0.88, rotate: "-28deg", color: palette.accent },
  { id: "bottom-left", left: 64, top: 98, x: -30, y: 36, scale: 0.72, rotate: "8deg", color: palette.accentSoft },
  { id: "bottom-right", left: 88, top: 98, x: 30, y: 34, scale: 0.76, rotate: "-18deg", color: palette.accent },
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
  const [captionDraft, setCaptionDraft] = useState("");
  const [pendingImportUri, setPendingImportUri] = useState<string | null>(null);
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
    if (!cameraRef.current || !activeQuest || pendingImportUri || savingPhoto || importingPhoto) {
      return;
    }

    try {
      setSavingPhoto(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });

      if (!photo?.uri) {
        return;
      }

      const savedUri = await saveCapturedPhoto(photo.uri);
      await addEntry(activeQuest.id, savedUri, entries.length === 0 ? 1 : 0, captionDraft);
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

      setPendingImportUri(result.assets[0].uri);
    } catch (error) {
      console.error(error);
      Alert.alert("Upload error", "That photo did not save. Try one more time.");
    } finally {
      setImportingPhoto(false);
    }
  }

  async function handleSaveImportedPhoto() {
    if (!activeQuest || !pendingImportUri || savingPhoto || importingPhoto) {
      return;
    }

    try {
      setSavingPhoto(true);
      const savedUri = await saveImportedPhoto(pendingImportUri);
      await addEntry(activeQuest.id, savedUri, entries.length === 0 ? 1 : 0, captionDraft);
      await finishMomentAdded();
    } catch (error) {
      console.error(error);
      Alert.alert("Upload error", "That photo did not save. Try one more time.");
    } finally {
      setSavingPhoto(false);
    }
  }

  function cancelPendingImport() {
    setPendingImportUri(null);
  }

  function flipCamera() {
    if (savingPhoto || importingPhoto) {
      return;
    }

    setCameraFacing((facing) => (facing === "back" ? "front" : "back"));
  }

  async function finishMomentAdded() {
    setCameraOpen(false);
    setCaptionDraft("");
    setPendingImportUri(null);
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
      "This will move it to your Trophy Room and make space for your next one.",
      [
        { text: "Keep going", style: "cancel" },
        {
          text: "Finish Quest",
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
    setCaptionDraft("");
    setCameraOpen(true);
  }

  function closeCamera() {
    setCameraOpen(false);
    setCaptionDraft("");
    setPendingImportUri(null);
  }

  function openMoment(moment: JournalEntry) {
    setMomentMenuOpen(false);
    setSelectedMoment(moment);
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

  async function handleDeleteSelectedMomentText() {
    if (!selectedMoment) {
      return;
    }

    const momentId = selectedMoment.id;
    await clearEntryCaption(momentId);
    const questEntries = await refreshData();
    setSelectedMoment(questEntries.find((entry) => entry.id === momentId) ?? { ...selectedMoment, caption: null });
    setMomentMenuOpen(false);
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
      <Modal animationType="slide" visible={cameraOpen} onRequestClose={closeCamera}>
        <View style={styles.cameraScreen}>
          <CameraView ref={cameraRef} facing={cameraFacing} style={StyleSheet.absoluteFill} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
            style={styles.cameraOverlay}
          >
            <View style={styles.cameraHeader}>
              <Text style={styles.cameraQuestTitle}>
                {activeEmoji} {activeQuest?.title}
              </Text>
              <Pressable
                onPress={closeCamera}
                style={styles.cameraCloseButton}
                accessibilityLabel="Close camera"
              >
                <Text style={styles.cameraCloseText}>×</Text>
              </Pressable>
            </View>
            {pendingImportUri ? (
              <View style={styles.importPreviewPanel}>
                <Image source={{ uri: pendingImportUri }} style={styles.importPreviewImage} />
                <View style={styles.cameraCaptionCard}>
                  <TextInput
                    value={captionDraft}
                    onChangeText={setCaptionDraft}
                    placeholder="Write a little something to celebrate you..."
                    placeholderTextColor="rgba(255, 255, 255, 0.72)"
                    style={styles.cameraCaptionInput}
                    maxLength={CAPTION_CHARACTER_LIMIT}
                    multiline
                    editable={!savingPhoto && !importingPhoto}
                  />
                  <Text style={styles.cameraCaptionCounter}>
                    {captionDraft.length}/{CAPTION_CHARACTER_LIMIT}
                  </Text>
                </View>
                <View style={styles.importPreviewActions}>
                  <Pressable
                    onPress={cancelPendingImport}
                    style={savingPhoto ? styles.importSecondaryButtonDisabled : styles.importSecondaryButton}
                    disabled={savingPhoto}
                  >
                    <Text style={styles.importSecondaryButtonText}>Choose Again</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSaveImportedPhoto}
                    style={savingPhoto ? styles.importPrimaryButtonDisabled : styles.importPrimaryButton}
                    disabled={savingPhoto}
                  >
                    <Text style={styles.importPrimaryButtonText}>Save Upload</Text>
                  </Pressable>
                </View>
                <View
                  style={styles.cameraStatusWrap}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Text style={styles.cameraStatusText}>{savingPhoto ? "Saving..." : " "}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.cameraActions}>
                <View style={styles.cameraCaptionCard}>
                  <TextInput
                    value={captionDraft}
                    onChangeText={setCaptionDraft}
                    placeholder="Write a little something to celebrate you..."
                    placeholderTextColor="rgba(255, 255, 255, 0.72)"
                    style={styles.cameraCaptionInput}
                    maxLength={CAPTION_CHARACTER_LIMIT}
                    multiline
                    editable={!savingPhoto && !importingPhoto}
                  />
                  <Text style={styles.cameraCaptionCounter}>
                    {captionDraft.length}/{CAPTION_CHARACTER_LIMIT}
                  </Text>
                </View>
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
            )}
          </KeyboardAvoidingView>
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

      <Modal
        animationType="fade"
        visible={!!selectedMoment}
        onRequestClose={() => {
          setMomentMenuOpen(false);
          setSelectedMoment(null);
        }}
      >
        <View style={styles.momentScreen}>
          <View pointerEvents="none" style={styles.momentGradientBase} />
          <View pointerEvents="none" style={styles.momentGradientTop} />
          <View pointerEvents="none" style={styles.momentGradientBottom} />
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
          {selectedMoment ? (
            <Image source={{ uri: selectedMoment.imageUri }} style={getMomentImageStyle(selectedMoment.caption)} />
          ) : null}
          {selectedMoment?.caption ? (
            <ScrollView
              style={getMomentReflectionStyle(selectedMoment.caption)}
              contentContainerStyle={styles.momentReflectionContent}
              showsVerticalScrollIndicator={false}
            >
              <ReflectionText caption={selectedMoment.caption} />
              <Text style={styles.momentTimestamp}>{formatTimestamp(selectedMoment.timestamp)}</Text>
            </ScrollView>
          ) : (
            <Text style={[styles.momentTimestamp, styles.momentTimestampSolo]}>
              {formatTimestamp(selectedMoment?.timestamp ?? null)}
            </Text>
          )}
          {momentMenuOpen ? (
            <View style={styles.momentMenu}>
              {selectedMoment?.caption ? (
                <Pressable onPress={handleDeleteSelectedMomentText} style={styles.deleteTextButton}>
                  <Text style={styles.deleteTextButtonText}>Delete text</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={handleDeleteSelectedMoment} style={styles.deleteMomentButton}>
                <Text style={styles.deleteMomentText}>Delete moment</Text>
              </Pressable>
            </View>
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
                      {entries.length === 0
                        ? `Take your first step as ${formatQuestIdentity(activeQuest.title)}`
                        : `${entries.length} ${entries.length === 1 ? "step" : "steps"} into your quest`}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={openCamera} style={styles.cameraButton} accessibilityLabel="Open camera">
                  <Text style={styles.cameraButtonText}>
                    {entries.length === 0 ? "Take Your First Step" : "Take Another Step"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.journeyCard}>
                <Text style={styles.sectionTitle}>From Then to Now</Text>
                <View style={styles.bridgeRow}>
                  <JourneyPanel label="First" entry={journeyPair.first} onPress={openMoment} />
                  <JourneyPanel label="Latest" entry={journeyPair.latest} onPress={openMoment} />
                </View>
              </View>

              <View
                onLayout={(event) => setScrapbookY(event.nativeEvent.layout.y)}
                style={styles.scrapbookArea}
              >
                <Text style={styles.sectionTitle}>Your Journey</Text>
                {entries.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No steps yet</Text>
                    <Text style={styles.sectionText}>Take your first step to begin.</Text>
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
                              onPress={() => openMoment(item)}
                            />
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Finish Your Quest</Text>
                <Text style={styles.sectionText}>
                  When you’re ready, close this chapter and start a new one.
                </Text>
                <Pressable onPress={handleCompleteQuest} style={styles.secondaryDestructiveButton}>
                  <Text style={styles.secondaryDestructiveText}>Finish Quest</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.onboardingCard}>
              <Text style={styles.sectionTitle}>Choose Your Quest</Text>
              <Text style={styles.sectionText}>
                What do you want to work toward?
              </Text>
              <TextInput
                value={questTitle}
                onChangeText={setQuestTitle}
                placeholder="Actor, Dancer, Marathon Runner, Writer..."
                placeholderTextColor="#8b6f6a"
                style={styles.input}
              />
              <Pressable onPress={handleCreateQuest} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Start This Quest</Text>
              </Pressable>
            </View>
          )
        ) : (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Trophy Room</Text>
            <Text style={styles.sectionText}>This is where your finished quests live.</Text>
            {archivedQuests.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No trophies yet</Text>
                <Text style={styles.sectionText}>Finish a quest to earn your first one.</Text>
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
          <Text style={screen === "home" ? styles.navIconActive : styles.navIcon}>
            {screen === "home" ? "▣" : "▢"}
          </Text>
          <Text style={screen === "home" ? styles.navTextActive : styles.navText}>Quest</Text>
        </Pressable>
        <Pressable
          onPress={() => setScreen("trophies")}
          style={screen === "trophies" ? styles.navItemActive : styles.navItem}
        >
          <Text style={screen === "trophies" ? styles.navIconActive : styles.navIcon}>
            {screen === "trophies" ? "★" : "☆"}
          </Text>
          <Text style={screen === "trophies" ? styles.navTextActive : styles.navText}>Trophy Room</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function JourneyPanel({
  label,
  entry,
  onPress,
}: {
  label: string;
  entry: JournalEntry | null;
  onPress: (entry: JournalEntry) => void;
}) {
  return (
    <View style={styles.bridgePanel}>
      <Text style={styles.bridgeLabel}>{label}</Text>
      {entry ? (
        <Pressable
          onPress={() => onPress(entry)}
          style={styles.bridgeImageWrap}
          accessibilityLabel={`Open ${label.toLowerCase()} moment`}
        >
          <Image source={{ uri: entry.imageUri }} style={styles.bridgeImage} />
          <Text style={styles.dateTag}>{formatShortDate(entry.timestamp)}</Text>
        </Pressable>
      ) : (
        <View style={styles.bridgePlaceholder}>
          <Text style={styles.placeholderText}>Your first step will show here</Text>
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

function ReflectionText({ caption }: { caption: string }) {
  const { firstSentence, remainingText } = splitFirstSentence(caption);

  return (
    <Text style={styles.momentCaption}>
      <Text style={styles.momentCaptionLead}>{firstSentence}</Text>
      {remainingText ? ` ${remainingText}` : ""}
    </Text>
  );
}

function getMomentImageStyle(caption: string | null) {
  const captionLength = caption?.trim().length ?? 0;

  if (captionLength === 0) {
    return [styles.momentImage, styles.momentImageNoCaption];
  }

  if (captionLength <= 45) {
    return [styles.momentImage, styles.momentImageShortCaption];
  }

  if (captionLength <= 120) {
    return [styles.momentImage, styles.momentImageMediumCaption];
  }

  return [styles.momentImage, styles.momentImageLongCaption];
}

function getMomentReflectionStyle(caption: string) {
  const captionLength = caption.trim().length;

  if (captionLength <= 45) {
    return [styles.momentReflectionScroll, styles.momentReflectionShort];
  }

  if (captionLength <= 120) {
    return [styles.momentReflectionScroll, styles.momentReflectionMedium];
  }

  return [styles.momentReflectionScroll, styles.momentReflectionLong];
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

function formatQuestIdentity(title: string) {
  const identity = title.trim().toLowerCase();

  if (!identity) {
    return "a quest";
  }

  const article = /^[aeiou]/.test(identity) ? "an" : "a";
  return `${article} ${identity}`;
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

  const date = new Date(dateString);
  const datePart = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${datePart} • ${timePart}`;
}

function splitFirstSentence(text: string) {
  const trimmedText = text.trim();
  const sentenceMatch = trimmedText.match(/^(.+?[.!?])(\s+[\s\S]*)?$/);

  if (!sentenceMatch) {
    return { firstSentence: trimmedText, remainingText: "" };
  }

  return {
    firstSentence: sentenceMatch[1],
    remainingText: sentenceMatch[2]?.trim() ?? "",
  };
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  container: {
    padding: 18,
    paddingBottom: 132,
    gap: 26,
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
    gap: 14,
    shadowColor: palette.shadow,
    shadowOpacity: 0.42,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionCard: {
    backgroundColor: palette.card,
    borderRadius: 8,
    padding: 18,
    gap: 14,
    shadowColor: palette.shadow,
    shadowOpacity: 0.36,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
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
    shadowColor: palette.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.ink,
    marginBottom: 6,
  },
  trophyCard: {
    backgroundColor: palette.card,
    borderRadius: 8,
    padding: 16,
    marginTop: 10,
    shadowColor: palette.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
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
  cameraCaptionCard: {
    width: "100%",
    backgroundColor: "rgba(20, 11, 16, 0.5)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 6,
  },
  cameraCaptionInput: {
    minHeight: 56,
    maxHeight: 92,
    color: "#fff",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    padding: 0,
    textAlignVertical: "top",
  },
  cameraCaptionCounter: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  importPreviewPanel: {
    width: "100%",
    gap: 10,
    alignItems: "center",
  },
  importPreviewImage: {
    width: "100%",
    height: 220,
    borderRadius: 8,
    resizeMode: "cover",
    backgroundColor: "rgba(20, 11, 16, 0.5)",
  },
  importPreviewActions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },
  importPrimaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.accentDark,
  },
  importPrimaryButtonDisabled: {
    flex: 1,
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: "rgba(124, 58, 237, 0.62)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(91, 33, 182, 0.62)",
  },
  importPrimaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
  importSecondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  importSecondaryButtonDisabled: {
    flex: 1,
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.58,
  },
  importSecondaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
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
    backgroundColor: "#120817",
    paddingHorizontal: 18,
    paddingTop: 46,
    paddingBottom: 18,
    gap: 22,
    overflow: "hidden",
  },
  momentGradientBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#170d24",
  },
  momentGradientTop: {
    position: "absolute",
    left: -60,
    right: -60,
    top: -180,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(124, 58, 237, 0.18)",
  },
  momentGradientBottom: {
    position: "absolute",
    left: -80,
    right: -80,
    bottom: -220,
    height: 440,
    borderRadius: 220,
    backgroundColor: "rgba(216, 199, 255, 0.09)",
  },
  momentTopBar: {
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
    borderRadius: 8,
    resizeMode: "contain",
  },
  momentImageNoCaption: {
    height: "74%",
  },
  momentImageShortCaption: {
    height: "68%",
  },
  momentImageMediumCaption: {
    height: "63%",
  },
  momentImageLongCaption: {
    height: "58%",
  },
  momentTimestamp: {
    color: "rgba(255, 255, 255, 0.58)",
    textAlign: "left",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 14,
  },
  momentTimestampSolo: {
    alignSelf: "center",
    textAlign: "center",
    marginTop: 0,
  },
  momentReflectionScroll: {
    width: "100%",
  },
  momentReflectionShort: {
    maxHeight: "16%",
  },
  momentReflectionMedium: {
    maxHeight: "23%",
  },
  momentReflectionLong: {
    maxHeight: "30%",
  },
  momentReflectionContent: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    paddingHorizontal: 30,
    paddingBottom: 8,
  },
  momentCaption: {
    color: "#fff",
    textAlign: "left",
    fontSize: 16,
    lineHeight: 25,
    fontWeight: "600",
  },
  momentCaptionLead: {
    fontWeight: "900",
  },
  momentMenu: {
    position: "absolute",
    left: 18,
    top: 104,
    gap: 8,
  },
  deleteTextButton: {
    backgroundColor: palette.card,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  deleteTextButtonText: {
    color: palette.ink,
    fontWeight: "900",
  },
  deleteMomentButton: {
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
    backgroundColor: palette.panel,
    borderRadius: 8,
    padding: 22,
    gap: 22,
    shadowColor: palette.shadowStrong,
    shadowOpacity: 1,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
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
  cameraButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  journeyCard: {
    backgroundColor: palette.card,
    borderRadius: 8,
    padding: 18,
    gap: 14,
    shadowColor: palette.shadow,
    shadowOpacity: 0.34,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
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
    color: palette.ink,
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
    backgroundColor: palette.panel,
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
    gap: 18,
  },
  momentSections: {
    gap: 26,
  },
  momentSection: {
    gap: 10,
  },
  momentSectionTitle: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    opacity: 0.7,
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
    borderColor: "rgba(124, 58, 237, 0.44)",
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
    backgroundColor: palette.paper,
    borderTopWidth: 1,
    borderTopColor: "rgba(124, 58, 237, 0.12)",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 18,
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.42,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  navItem: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    gap: 4,
  },
  navItemActive: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    gap: 4,
  },
  navIcon: {
    color: palette.muted,
    fontSize: 20,
    fontWeight: "900",
    opacity: 0.68,
  },
  navIconActive: {
    color: palette.accent,
    fontSize: 20,
    fontWeight: "900",
  },
  navText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  navTextActive: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: "900",
  },
});
