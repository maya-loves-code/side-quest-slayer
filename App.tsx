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
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
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
  getActiveQuests,
  getArchivedQuests,
  getDailyReminderEnabled,
  getEntriesForQuest,
  getJourneyPair,
  getLastOpenQuestId,
  initializeDatabase,
  setDailyReminderEnabled,
  setLastOpenQuestId,
  updateQuestEmoji,
} from "./src/lib/db";
import { cancelDailyQuestReminder, scheduleDailyQuestReminder } from "./src/lib/notifications";
import { deleteStoredPhoto, saveCapturedPhoto, saveImportedPhoto } from "./src/lib/storage";
import { palette } from "./src/theme/colors";
import type { JournalEntry, Quest } from "./src/types";

type Screen = "home" | "trophies" | "settings";

type JourneyState = {
  first: JournalEntry | null;
  latest: JournalEntry | null;
};

type ArchivedQuestView = {
  quest: Quest;
  entries: JournalEntry[];
  firstEntry: JournalEntry | null;
  latestEntry: JournalEntry | null;
  durationLabel: string;
  captionHighlights: string[];
};

type ArchivedQuestSummary = ArchivedQuestView;

type MomentSection = {
  title: string;
  entries: JournalEntry[];
};

const EMOJI_OPTIONS = ["⚔️", "🎨", "💃", "💪", "🎓", "💻", "🎵", "✍️", "📷", "🌱", "🧵", "🛠️", "🎭", "🧠", "🏃‍♀️"];
const QUEST_TITLE_CHARACTER_LIMIT = 80;
const CAPTION_CHARACTER_LIMIT = 180;
const PRIVACY_POLICY_URL = "https://maya-loves-code.github.io/side-quest-slayer/privacy-policy.html";
const REFLECTION_PROMPTS = [
  "What felt easier today?",
  "What are you proud of?",
  "What did you try even though it was awkward?",
  "What would future you want to remember?",
  "What did you show up for today?",
  "What changed, even a little?",
  "What did you learn about yourself?",
  "What part of this felt most alive?",
  "What did you do that past you would admire?",
  "What are you choosing to keep practicing?",
  "What felt hard, but still worth it?",
  "What small win deserves credit?",
  "What surprised you about today?",
  "What did you make possible by starting?",
  "What would you tell yourself to remember?",
  "What did courage look like today?",
  "What are you building, one step at a time?",
  "What felt more like you today?",
  "What did you keep going through?",
  "What deserves a tiny celebration?",
];
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
  const [activeQuests, setActiveQuests] = useState<Quest[]>([]);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [archivedQuests, setArchivedQuests] = useState<ArchivedQuestSummary[]>([]);
  const [questPickerOpen, setQuestPickerOpen] = useState(false);
  const [newQuestFormOpen, setNewQuestFormOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraType>("back");
  const [captionDraft, setCaptionDraft] = useState("");
  const [reflectionPromptIndex, setReflectionPromptIndex] = useState(0);
  const [pendingCaptureUri, setPendingCaptureUri] = useState<string | null>(null);
  const [pendingImportUri, setPendingImportUri] = useState<string | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [importingPhoto, setImportingPhoto] = useState(false);
  const [creatingQuest, setCreatingQuest] = useState(false);
  const [completingQuest, setCompletingQuest] = useState(false);
  const [deletingMoment, setDeletingMoment] = useState(false);
  const [schedulingReminder, setSchedulingReminder] = useState(false);
  const [dailyReminderEnabled, setDailyReminderEnabledState] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [selectedMoment, setSelectedMoment] = useState<JournalEntry | null>(null);
  const [selectedMomentReadOnly, setSelectedMomentReadOnly] = useState(false);
  const [momentMenuOpen, setMomentMenuOpen] = useState(false);
  const [highlightedMomentId, setHighlightedMomentId] = useState<number | null>(null);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [scrapbookY, setScrapbookY] = useState(0);
  const [journeyPair, setJourneyPair] = useState<JourneyState>({ first: null, latest: null });
  const [archivedQuestView, setArchivedQuestView] = useState<ArchivedQuestView | null>(null);

  const activeEmoji = selectedQuest?.emoji ?? getQuestEmoji(selectedQuest?.title ?? "");
  const captionPlaceholder = REFLECTION_PROMPTS[reflectionPromptIndex];
  const pendingPreviewUri = pendingCaptureUri ?? pendingImportUri;
  const isPreviewingMoment = Boolean(pendingPreviewUri);
  const isPendingCapture = Boolean(pendingCaptureUri);
  const momentSections = useMemo(() => createMomentSections(entries), [entries]);
  const archivedMomentSections = useMemo(
    () => createMomentSections(archivedQuestView?.entries ?? []),
    [archivedQuestView?.entries]
  );
  const momentTileWidth = Math.floor((width - 46) / 2);
  const clearCelebration = useCallback(() => setHighlightedMomentId(null), []);

  useEffect(() => {
    void bootstrapApp();
  }, []);

  async function bootstrapApp() {
    try {
      await initializeDatabase();
      setDailyReminderEnabledState(await getDailyReminderEnabled());
      await refreshData();
    } catch (error) {
      console.error(error);
      Alert.alert("Setup error", "Side Quest Slayer could not finish setting up local storage.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshData(preferredQuestId?: number | null) {
    const lastOpenQuestId = preferredQuestId !== undefined ? preferredQuestId : await getLastOpenQuestId();
    const quests = await getActiveQuests();
    const nextQuest = quests.find((quest) => quest.id === lastOpenQuestId) ?? quests[0] ?? null;
    const trophies = await getArchivedQuests();
    const trophySummaries = await Promise.all(
      trophies.map(async (trophy) => createArchivedQuestSummary(trophy, await getEntriesForQuest(trophy.id)))
    );
    const [questEntries, pair] = await Promise.all([
      nextQuest ? getEntriesForQuest(nextQuest.id) : Promise.resolve([]),
      nextQuest ? getJourneyPair(nextQuest.id) : Promise.resolve({ first: null, latest: null }),
    ]);

    setActiveQuests(quests);
    setSelectedQuest(nextQuest);
    setArchivedQuests(trophySummaries);
    setEntries(questEntries);
    setJourneyPair(pair);

    if (nextQuest && nextQuest.id !== lastOpenQuestId) {
      await setLastOpenQuestId(nextQuest.id);
    }

    return questEntries;
  }

  async function handleCreateQuest() {
    const trimmedTitle = questTitle.trim();

    if (creatingQuest) {
      return;
    }

    if (!trimmedTitle) {
      Alert.alert("Name your quest", "Give your goal a name before you commit.");
      return;
    }

    try {
      setCreatingQuest(true);
      const createdQuest = await createQuest(trimmedTitle, getQuestEmoji(trimmedTitle));

      if (!createdQuest) {
        Alert.alert("Quest error", "That quest did not start. Try one more time.");
        return;
      }

      await setLastOpenQuestId(createdQuest.id);
      setQuestTitle("");
      setQuestPickerOpen(false);
      setNewQuestFormOpen(false);
      await refreshData(createdQuest.id);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error) {
      console.error(error);
      Alert.alert("Quest error", "That quest did not start. Try one more time.");
    } finally {
      setCreatingQuest(false);
    }
  }

  async function handleSelectQuest(questId: number) {
    if (selectedQuest?.id === questId) {
      closeQuestPicker();
      return;
    }

    if (savingPhoto || importingPhoto) {
      return;
    }

    closeQuestPicker();
    setHighlightedMomentId(null);
    setSelectedMoment(null);
    setMomentMenuOpen(false);
    await setLastOpenQuestId(questId);
    await refreshData(questId);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }

  function closeQuestPicker() {
    setQuestPickerOpen(false);
    setNewQuestFormOpen(false);
  }

  async function handleCapturePhoto() {
    if (!cameraRef.current || !selectedQuest || pendingPreviewUri || savingPhoto || importingPhoto) {
      return;
    }

    try {
      setSavingPhoto(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 1 });

      if (!photo?.uri) {
        return;
      }

      setPendingCaptureUri(photo.uri);
    } catch (error) {
      console.error(error);
      Alert.alert("Camera error", "That photo did not capture. Try one more time.");
    } finally {
      setSavingPhoto(false);
    }
  }

  async function handleImportPhoto() {
    if (!selectedQuest || pendingPreviewUri || savingPhoto || importingPhoto) {
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

  async function handleSaveCapturedPhoto() {
    if (!selectedQuest || !pendingCaptureUri || savingPhoto || importingPhoto) {
      return;
    }

    try {
      setSavingPhoto(true);
      await saveMoment(pendingCaptureUri, "capture");
      await finishMomentAdded();
    } catch (error) {
      console.error(error);
      Alert.alert("Camera error", "That photo did not save. Try one more time.");
    } finally {
      setSavingPhoto(false);
    }
  }

  async function handleSaveImportedPhoto() {
    if (!selectedQuest || !pendingImportUri || savingPhoto || importingPhoto) {
      return;
    }

    try {
      setSavingPhoto(true);
      await saveMoment(pendingImportUri, "import");
      await finishMomentAdded();
    } catch (error) {
      console.error(error);
      Alert.alert("Upload error", "That photo did not save. Try one more time.");
    } finally {
      setSavingPhoto(false);
    }
  }

  function cancelPendingCapture() {
    setPendingCaptureUri(null);
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

  async function saveMoment(sourceUri: string, source: "capture" | "import") {
    if (!selectedQuest) {
      return;
    }

    let savedUri: string | null = null;

    try {
      savedUri = source === "capture" ? await saveCapturedPhoto(sourceUri) : await saveImportedPhoto(sourceUri);
      await addEntry(selectedQuest.id, savedUri, entries.length === 0 ? 1 : 0, captionDraft);
    } catch (error) {
      if (savedUri) {
        await deleteStoredPhoto(savedUri);
      }

      throw error;
    }
  }

  async function finishMomentAdded() {
    setCameraOpen(false);
    setCaptionDraft("");
    setPendingCaptureUri(null);
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
    if (!selectedQuest || completingQuest) {
      return;
    }

    const questToComplete = selectedQuest;

    Alert.alert(
      "Complete quest?",
      "This will move it to your Trophy Room. Your other quests will stay active.",
      [
        { text: "Keep going", style: "cancel" },
        {
          text: "Finish Quest",
          onPress: async () => {
            try {
              setCompletingQuest(true);
              await completeQuest(questToComplete.id);
              await refreshData(questToComplete.id);
            } catch (error) {
              console.error(error);
              Alert.alert("Quest error", "That quest did not finish. Try one more time.");
            } finally {
              setCompletingQuest(false);
            }
          },
        },
      ]
    );
  }

  async function openCamera() {
    if (!selectedQuest) {
      return;
    }

    if (!permission?.granted) {
      const result = await requestPermission();

      if (!result.granted) {
        Alert.alert("Camera needed", "You need camera access to create daily proof entries.");
        return;
      }
    }

    setCameraFacing("back");
    setCaptionDraft("");
    setPendingCaptureUri(null);
    setPendingImportUri(null);
    setReflectionPromptIndex((index) => (index + 1) % REFLECTION_PROMPTS.length);
    setCameraOpen(true);
  }

  function closeCamera() {
    setCameraOpen(false);
    setCaptionDraft("");
    setPendingCaptureUri(null);
    setPendingImportUri(null);
  }

  async function openPrivacyPolicy() {
    try {
      const canOpenPrivacyPolicy = await Linking.canOpenURL(PRIVACY_POLICY_URL);

      if (!canOpenPrivacyPolicy) {
        Alert.alert("Privacy Policy", `Open this link in your browser: ${PRIVACY_POLICY_URL}`);
        return;
      }

      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch {
      Alert.alert("Privacy Policy", `Open this link in your browser: ${PRIVACY_POLICY_URL}`);
    }
  }

  async function handleSetDailyReminder(nextEnabled: boolean) {
    if (schedulingReminder) {
      return;
    }

    try {
      setSchedulingReminder(true);

      if (!nextEnabled) {
        await cancelDailyQuestReminder();
        await setDailyReminderEnabled(false);
        setDailyReminderEnabledState(false);
        return;
      }

      const scheduled = await scheduleDailyQuestReminder();

      if (scheduled) {
        await setDailyReminderEnabled(true);
        setDailyReminderEnabledState(true);
      } else {
        await setDailyReminderEnabled(false);
        setDailyReminderEnabledState(false);
        Alert.alert("Notifications off", "You can enable notifications in your device settings when you want reminders.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Reminder error", "That reminder did not schedule. Try one more time.");
    } finally {
      setSchedulingReminder(false);
    }
  }

  function openMoment(moment: JournalEntry, isReadOnly = false) {
    setMomentMenuOpen(false);
    setSelectedMomentReadOnly(isReadOnly);
    setSelectedMoment(moment);
  }

  async function openArchivedQuest(summary: ArchivedQuestSummary) {
    const questEntries = await getEntriesForQuest(summary.quest.id);
    setArchivedQuestView(createArchivedQuestSummary(summary.quest, questEntries));
    setMomentMenuOpen(false);
    setSelectedMoment(null);
    setSelectedMomentReadOnly(false);
  }

  function closeArchivedQuest() {
    setArchivedQuestView(null);
    setMomentMenuOpen(false);
    setSelectedMoment(null);
    setSelectedMomentReadOnly(false);
  }

  async function handleEmojiSelect(emoji: string) {
    if (!selectedQuest) {
      return;
    }

    await updateQuestEmoji(selectedQuest.id, emoji);
    setEmojiPickerOpen(false);
    await refreshData(selectedQuest.id);
  }

  async function handleDeleteSelectedMoment() {
    if (!selectedMoment || deletingMoment) {
      return;
    }

    const moment = selectedMoment;

    try {
      setDeletingMoment(true);
      const photoDeleted = await deleteStoredPhoto(moment.imageUri);

      if (!photoDeleted) {
        Alert.alert("Delete error", "That moment photo could not be deleted, so the entry was kept safe.");
        return;
      }

      setSelectedMoment(null);
      setMomentMenuOpen(false);
      await deleteEntry(moment.id);
      await refreshData();
    } catch (error) {
      console.error(error);
      Alert.alert("Delete error", "That moment could not be deleted. Try one more time.");
    } finally {
      setDeletingMoment(false);
    }
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
          {!isPreviewingMoment ? (
            <CameraView ref={cameraRef} facing={cameraFacing} style={StyleSheet.absoluteFill} />
          ) : null}
          {isPreviewingMoment ? (
            <>
              <View pointerEvents="none" style={styles.momentGradientBase} />
              <View pointerEvents="none" style={styles.momentGradientTop} />
              <View pointerEvents="none" style={styles.momentGradientBottom} />
            </>
          ) : null}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
            style={isPreviewingMoment ? styles.previewOverlay : styles.cameraOverlay}
          >
            <View style={styles.cameraHeader}>
              <Text style={styles.cameraQuestTitle}>
                {activeEmoji} {selectedQuest?.title}
              </Text>
              <Pressable
                onPress={closeCamera}
                style={styles.cameraCloseButton}
                accessibilityLabel="Close camera"
              >
                <Text style={styles.cameraCloseText}>×</Text>
              </Pressable>
            </View>
            {pendingPreviewUri ? (
              <View style={styles.importPreviewPanel}>
                <Image source={{ uri: pendingPreviewUri }} style={styles.importPreviewImage} />
                <View style={styles.cameraCaptionCard}>
                  <TextInput
                    value={captionDraft}
                    onChangeText={setCaptionDraft}
                    placeholder={captionPlaceholder}
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
                    onPress={isPendingCapture ? cancelPendingCapture : cancelPendingImport}
                    style={savingPhoto ? styles.importSecondaryButtonDisabled : styles.importSecondaryButton}
                    disabled={savingPhoto}
                    accessibilityLabel={isPendingCapture ? "Retake photo" : "Choose another photo"}
                  >
                    <Text style={styles.importSecondaryButtonText}>
                      {isPendingCapture ? "Retake" : "Choose Again"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={isPendingCapture ? handleSaveCapturedPhoto : handleSaveImportedPhoto}
                    style={savingPhoto ? styles.importPrimaryButtonDisabled : styles.importPrimaryButton}
                    disabled={savingPhoto}
                    accessibilityLabel="Save moment"
                  >
                    <Text style={styles.importPrimaryButtonText}>Save Moment</Text>
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
                    placeholder={captionPlaceholder}
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
          setSelectedMomentReadOnly(false);
        }}
      >
        <View style={styles.momentScreen}>
          <View pointerEvents="none" style={styles.momentGradientBase} />
          <View pointerEvents="none" style={styles.momentGradientTop} />
          <View pointerEvents="none" style={styles.momentGradientBottom} />
          <View style={styles.momentTopBar}>
            {selectedMomentReadOnly ? (
              <View style={styles.momentIconButtonPlaceholder} />
            ) : (
              <Pressable onPress={() => setMomentMenuOpen((isOpen) => !isOpen)} style={styles.momentIconButton}>
                <Text style={styles.momentDots}>...</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                setMomentMenuOpen(false);
                setSelectedMoment(null);
                setSelectedMomentReadOnly(false);
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
          {momentMenuOpen && !selectedMomentReadOnly ? (
            <View style={styles.momentMenu}>
              {selectedMoment?.caption ? (
                <Pressable onPress={handleDeleteSelectedMomentText} style={styles.deleteTextButton}>
                  <Text style={styles.deleteTextButtonText}>Delete text</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={handleDeleteSelectedMoment}
                style={deletingMoment ? styles.deleteMomentButtonDisabled : styles.deleteMomentButton}
                disabled={deletingMoment}
              >
                <Text style={styles.deleteMomentText}>{deletingMoment ? "Deleting..." : "Delete moment"}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={questPickerOpen} onRequestClose={closeQuestPicker}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
          style={styles.sheetBackdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeQuestPicker} />
          <View style={styles.questSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Choose Quest</Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.questSheetList}
              contentContainerStyle={styles.questSheetListContent}
            >
              {activeQuests.map((quest) => {
                const isSelected = quest.id === selectedQuest?.id;
                const emoji = quest.emoji ?? getQuestEmoji(quest.title);

                return (
                  <Pressable
                    key={quest.id}
                    onPress={() => handleSelectQuest(quest.id)}
                    style={isSelected ? styles.questSheetItemSelected : styles.questSheetItem}
                    accessibilityLabel={`Open ${quest.title}`}
                  >
                    <Text style={styles.questSheetEmoji}>{emoji}</Text>
                    <Text
                      numberOfLines={1}
                      style={isSelected ? styles.questSheetNameSelected : styles.questSheetName}
                    >
                      {quest.title}
                    </Text>
                    <Text style={styles.questSheetCheck}>{isSelected ? "✓" : ""}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {newQuestFormOpen ? (
              <View style={styles.questSheetForm}>
                <TextInput
                  value={questTitle}
                  onChangeText={setQuestTitle}
                  placeholder="Actor, Dancer, Marathon Runner, Writer..."
                  placeholderTextColor="#8b6f6a"
                  style={styles.input}
                  maxLength={QUEST_TITLE_CHARACTER_LIMIT}
                  editable={!creatingQuest}
                />
                <Pressable
                  onPress={handleCreateQuest}
                  style={creatingQuest ? styles.primaryButtonDisabled : styles.primaryButton}
                  disabled={creatingQuest}
                >
                  <Text style={styles.primaryButtonText}>{creatingQuest ? "Starting..." : "Start This Quest"}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setNewQuestFormOpen(true)}
                style={creatingQuest ? styles.questSheetNewButtonDisabled : styles.questSheetNewButton}
                disabled={creatingQuest}
              >
                <Text style={styles.questSheetNewText}>+ New Quest</Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.title}>Side Quest Slayer</Text>
        </View>

        {screen === "home" ? (
          selectedQuest ? (
            <>
              <Pressable
                onPress={() => setQuestPickerOpen(true)}
                style={styles.currentQuestSelector}
                hitSlop={{ top: 13, bottom: 13, left: 12, right: 12 }}
                accessibilityLabel="Choose current quest"
              >
                <Text numberOfLines={1} style={styles.currentQuestSelectorText}>
                  {activeEmoji} {selectedQuest.title}
                </Text>
                <Text style={styles.currentQuestSelectorChevron}>▼</Text>
              </Pressable>

              <View style={styles.questCard}>
                <View style={styles.questHeader}>
                  <Pressable onPress={() => setEmojiPickerOpen(true)} style={styles.questEmojiButton}>
                    <Text style={styles.questEmoji}>{activeEmoji}</Text>
                  </Pressable>
                  <View style={styles.questTitleWrap}>
                    <Text style={styles.questTitle}>{selectedQuest.title}</Text>
                    <Text style={styles.momentCount}>
                      {entries.length === 0
                        ? `Take your first step as ${formatQuestIdentity(selectedQuest.title)}`
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
                  Ready to celebrate this chapter? Finish your quest and save it to your Trophy Room.
                </Text>
                <Pressable
                  onPress={handleCompleteQuest}
                  style={completingQuest ? styles.finishQuestButtonDisabled : styles.finishQuestButton}
                  disabled={completingQuest}
                >
                  <Text style={styles.finishQuestButtonText}>{completingQuest ? "Finishing..." : "Finish Quest"}</Text>
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
                maxLength={QUEST_TITLE_CHARACTER_LIMIT}
                editable={!creatingQuest}
              />
              <Pressable
                onPress={handleCreateQuest}
                style={creatingQuest ? styles.primaryButtonDisabled : styles.primaryButton}
                disabled={creatingQuest}
              >
                <Text style={styles.primaryButtonText}>{creatingQuest ? "Starting..." : "Start This Quest"}</Text>
              </Pressable>
            </View>
          )
        ) : screen === "trophies" && archivedQuestView ? (
          <View style={styles.archiveDetailArea}>
            <Pressable onPress={closeArchivedQuest} style={styles.archiveBackButton}>
              <Text style={styles.archiveBackText}>Back to Trophy Room</Text>
            </Pressable>

            <View style={styles.recapHeroCard}>
              <Text style={styles.recapEyebrow}>Quest Complete</Text>
              <Text style={styles.recapTitle}>
                {archivedQuestView.quest.emoji ?? getQuestEmoji(archivedQuestView.quest.title)} {archivedQuestView.quest.title}
              </Text>
              <Text style={styles.recapSubtitle}>You made this chapter real.</Text>
              <View style={styles.recapStatsGrid}>
                <RecapStat
                  label="Steps"
                  value={`${archivedQuestView.entries.length}`}
                />
                <RecapStat label="Started" value={formatDate(archivedQuestView.quest.startedAt)} />
                <RecapStat label="Finished" value={formatDate(archivedQuestView.quest.completedAt)} />
                <RecapStat label="Duration" value={archivedQuestView.durationLabel} />
              </View>
            </View>

            <View style={styles.journeyCard}>
              <Text style={styles.sectionTitle}>From Then to Now</Text>
              <View style={styles.bridgeRow}>
                <JourneyPanel label="First Step" entry={archivedQuestView.firstEntry} onPress={(entry) => openMoment(entry, true)} />
                <JourneyPanel label="Latest Step" entry={archivedQuestView.latestEntry} onPress={(entry) => openMoment(entry, true)} />
              </View>
            </View>

            {archivedQuestView.captionHighlights.length > 0 ? (
              <View style={styles.recapHighlightsCard}>
                <Text style={styles.sectionTitle}>Reflection Highlights</Text>
                {archivedQuestView.captionHighlights.map((highlight, index) => (
                  <View key={`${highlight}-${index}`} style={styles.highlightItem}>
                    <Text style={styles.highlightQuote}>{highlight}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.scrapbookArea}>
              <Text style={styles.sectionTitle}>Archived Journey</Text>
              {archivedQuestView.entries.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No steps were logged for this quest.</Text>
                </View>
              ) : (
                <View style={styles.momentSections}>
                  {archivedMomentSections.map((section) => (
                    <View key={section.title} style={styles.momentSection}>
                      <Text style={styles.momentSectionTitle}>{section.title}</Text>
                      <View style={styles.momentGrid}>
                        {section.entries.map((item, index) => (
                          <MomentTile
                            key={item.id}
                            item={item}
                            index={index}
                            isHighlighted={false}
                            tileWidth={momentTileWidth}
                            onPress={() => openMoment(item, true)}
                          />
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : screen === "trophies" ? (
          <View style={styles.trophyRoom}>
            <View style={styles.trophyRoomHeader}>
              <Text style={styles.trophyRoomTitle}>Trophy Room</Text>
              <Text style={styles.trophyRoomText}>Your finished quests. Tap any quest to relive the journey.</Text>
            </View>
            {archivedQuests.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No trophies yet</Text>
                <Text style={styles.sectionText}>Finish a quest to earn your first one.</Text>
              </View>
            ) : (
              <View style={styles.trophyList}>
                {archivedQuests.map((questSummary) => (
                  <TrophyCard
                    key={questSummary.quest.id}
                    summary={questSummary}
                    onPress={() => openArchivedQuest(questSummary)}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.settingsScreen}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Settings</Text>
            </View>

            <View style={styles.settingsSection}>
              <Pressable
                onPress={() => handleSetDailyReminder(!dailyReminderEnabled)}
                style={styles.settingsControlRow}
                disabled={schedulingReminder}
                accessibilityRole="switch"
                accessibilityState={{ checked: dailyReminderEnabled, disabled: schedulingReminder }}
                accessibilityLabel="Daily Reminder"
              >
                <View style={styles.settingsRowText}>
                  <Text style={styles.settingsRowTitle}>Daily Reminder</Text>
                  <Text style={styles.settingsRowSubtext}>Get a quiet nudge each evening</Text>
                </View>
                <Switch
                  value={dailyReminderEnabled}
                  disabled={schedulingReminder}
                  pointerEvents="none"
                  trackColor={{ false: "rgba(107, 97, 120, 0.22)", true: palette.accentSoft }}
                  thumbColor={dailyReminderEnabled ? palette.accent : "#fff"}
                  ios_backgroundColor="rgba(107, 97, 120, 0.22)"
                />
              </Pressable>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>Privacy</Text>
              <Text style={styles.settingsText}>
                Your quest photos and reflections are stored only on this device.
              </Text>
              <Pressable
                onPress={openPrivacyPolicy}
                style={styles.settingsLinkRow}
                accessibilityRole="link"
                accessibilityLabel="Open privacy policy"
              >
                <Text style={styles.settingsRowTitle}>Privacy Policy</Text>
                <Text style={styles.settingsRowArrow}>›</Text>
              </Pressable>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>App Info</Text>
              <Text style={styles.settingsText}>Version 1.0.0</Text>
              <Text style={styles.settingsText}>Local-first progress journal</Text>
            </View>
          </View>
        )}
      </ScrollView>
      {highlightedMomentId !== null && screen === "home" ? (
        <CelebrationOverlay key={celebrationKey} onDone={clearCelebration} />
      ) : null}
      <View style={styles.bottomNav}>
        <Pressable
          onPress={() => {
            setScreen("home");
            setArchivedQuestView(null);
          }}
          style={screen === "home" ? styles.navItemActive : styles.navItem}
        >
          <Text style={screen === "home" ? styles.navIconActive : styles.navIcon}>
            {screen === "home" ? "▣" : "▢"}
          </Text>
          <Text style={screen === "home" ? styles.navTextActive : styles.navText}>Quest</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setScreen("trophies");
            setArchivedQuestView(null);
          }}
          style={screen === "trophies" ? styles.navItemActive : styles.navItem}
        >
          <Text style={screen === "trophies" ? styles.navIconActive : styles.navIcon}>
            {screen === "trophies" ? "★" : "☆"}
          </Text>
          <Text style={screen === "trophies" ? styles.navTextActive : styles.navText}>Trophy Room</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setScreen("settings");
            setArchivedQuestView(null);
          }}
          style={screen === "settings" ? styles.navItemActive : styles.navItem}
        >
          <Text style={screen === "settings" ? styles.navIconActive : styles.navIcon}>
            {screen === "settings" ? "●" : "○"}
          </Text>
          <Text style={screen === "settings" ? styles.navTextActive : styles.navText}>Settings</Text>
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

function TrophyCard({ summary, onPress }: { summary: ArchivedQuestSummary; onPress: () => void }) {
  const emoji = summary.quest.emoji ?? getQuestEmoji(summary.quest.title);
  const stepLabel = `${summary.entries.length} ${summary.entries.length === 1 ? "step" : "steps"}`;

  return (
    <Pressable onPress={onPress} style={styles.trophyCard}>
      <View style={styles.trophyHeader}>
        <View style={styles.trophyEmojiBadge}>
          <Text style={styles.trophyEmoji}>{emoji}</Text>
        </View>
        <View style={styles.trophyTitleWrap}>
          <Text style={styles.trophyTitle}>{summary.quest.title}</Text>
          <Text style={styles.trophyMeta}>Completed {formatDate(summary.quest.completedAt)}</Text>
        </View>
      </View>

      {summary.firstEntry || summary.latestEntry ? (
        <View style={styles.trophyPreviewRow}>
          <TrophyPreview label="First" entry={summary.firstEntry} />
          <TrophyPreview label="Latest" entry={summary.latestEntry} />
        </View>
      ) : (
        <View style={styles.trophyEmptyPreview}>
          <Text style={styles.trophyEmptyPreviewText}>No steps were logged for this quest.</Text>
        </View>
      )}

      <View style={styles.trophyStatsRow}>
        <Text style={styles.trophyStatText}>{stepLabel}</Text>
        <Text style={styles.trophyStatDivider}>•</Text>
        <Text style={styles.trophyStatText}>{summary.durationLabel}</Text>
      </View>
    </Pressable>
  );
}

function TrophyPreview({ label, entry }: { label: string; entry: JournalEntry | null }) {
  return (
    <View style={styles.trophyPreview}>
      {entry ? (
        <Image source={{ uri: entry.imageUri }} style={styles.trophyPreviewImage} />
      ) : (
        <View style={styles.trophyPreviewPlaceholder} />
      )}
      <Text style={styles.trophyPreviewLabel}>{label}</Text>
    </View>
  );
}

function RecapStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recapStat}>
      <Text style={styles.recapStatValue}>{value}</Text>
      <Text style={styles.recapStatLabel}>{label}</Text>
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

function getEntryJourneyPair(entries: JournalEntry[]): JourneyState {
  if (entries.length === 0) {
    return { first: null, latest: null };
  }

  const sortedEntries = [...entries].sort(
    (first, second) => new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime()
  );

  return {
    first: sortedEntries[0],
    latest: sortedEntries[sortedEntries.length - 1],
  };
}

function createArchivedQuestSummary(quest: Quest, entries: JournalEntry[]): ArchivedQuestSummary {
  const sortedEntries = [...entries].sort(
    (first, second) => new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime()
  );

  return {
    quest,
    entries,
    firstEntry: sortedEntries[0] ?? null,
    latestEntry: sortedEntries[sortedEntries.length - 1] ?? null,
    durationLabel: getQuestDurationLabel(quest.startedAt, quest.completedAt),
    captionHighlights: getCaptionHighlights(entries),
  };
}

function getCaptionHighlights(entries: JournalEntry[]) {
  return [...entries]
    .sort((first, second) => new Date(second.timestamp).getTime() - new Date(first.timestamp).getTime())
    .map((entry) => entry.caption?.trim() ?? "")
    .filter(Boolean)
    .slice(0, 3)
    .map((caption) => splitFirstSentence(caption).firstSentence);
}

function getQuestDurationLabel(startedAt: string, completedAt: string | null) {
  const startedDate = new Date(startedAt);
  const completedDate = completedAt ? new Date(completedAt) : new Date();
  const durationInDays = Math.max(
    1,
    Math.ceil((startOfDay(completedDate).getTime() - startOfDay(startedDate).getTime()) / 86400000) + 1
  );

  return `${durationInDays} ${durationInDays === 1 ? "day" : "days"}`;
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
  currentQuestSelector: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    borderRadius: 8,
    paddingHorizontal: 2,
    paddingVertical: 1,
    marginTop: -18,
    marginBottom: -16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  currentQuestSelectorText: {
    flexShrink: 1,
    color: palette.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  currentQuestSelectorChevron: {
    color: palette.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: palette.backdrop,
    justifyContent: "flex-end",
  },
  questSheet: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    padding: 18,
    paddingBottom: 28,
    gap: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
    alignSelf: "center",
  },
  sheetTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  questSheetList: {
    maxHeight: 320,
  },
  questSheetListContent: {
    gap: 8,
  },
  questSheetItem: {
    minHeight: 54,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.border,
  },
  questSheetItemSelected: {
    minHeight: 54,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.28)",
  },
  questSheetEmoji: {
    fontSize: 24,
  },
  questSheetName: {
    flex: 1,
    color: palette.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  questSheetNameSelected: {
    flex: 1,
    color: palette.accent,
    fontSize: 16,
    fontWeight: "900",
  },
  questSheetCheck: {
    width: 22,
    color: palette.accent,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
  },
  questSheetNewButton: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.24)",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  questSheetNewButtonDisabled: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.panel,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.62,
  },
  questSheetNewText: {
    color: palette.accent,
    fontSize: 15,
    fontWeight: "900",
  },
  questSheetForm: {
    gap: 10,
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
  settingsScreen: {
    gap: 22,
  },
  settingsHeader: {
    paddingHorizontal: 2,
    paddingTop: 4,
  },
  settingsTitle: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: "900",
  },
  settingsSection: {
    backgroundColor: "#fbf8ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    gap: 12,
  },
  settingsSectionTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  settingsText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  settingsControlRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  settingsLinkRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 12,
  },
  settingsRowText: {
    flex: 1,
    gap: 3,
  },
  settingsRowTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  settingsRowSubtext: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  settingsRowArrow: {
    color: palette.muted,
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 26,
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
  primaryButtonDisabled: {
    backgroundColor: palette.accentDark,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    opacity: 0.62,
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
  archiveBackButton: {
    alignSelf: "flex-start",
    backgroundColor: palette.panel,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  archiveBackText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  archiveDetailArea: {
    gap: 18,
  },
  recapHeroCard: {
    backgroundColor: palette.accentDark,
    borderRadius: 8,
    padding: 20,
    gap: 16,
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.8,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  recapEyebrow: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  recapTitle: {
    color: "#fff",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
  },
  recapSubtitle: {
    color: "rgba(255, 255, 255, 0.84)",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700",
  },
  recapStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  recapStat: {
    width: "47%",
    minHeight: 78,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.13)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    padding: 12,
    justifyContent: "space-between",
  },
  recapStatValue: {
    color: "#fff",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },
  recapStatLabel: {
    color: "rgba(255, 255, 255, 0.68)",
    fontSize: 12,
    fontWeight: "900",
  },
  recapHighlightsCard: {
    backgroundColor: palette.card,
    borderRadius: 8,
    padding: 18,
    gap: 12,
    shadowColor: palette.shadow,
    shadowOpacity: 0.34,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  highlightItem: {
    backgroundColor: palette.paper,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  highlightQuote: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
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
  finishQuestButton: {
    backgroundColor: palette.accent,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.accentDark,
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.42,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  finishQuestButtonDisabled: {
    backgroundColor: palette.accentDark,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.accentDark,
    opacity: 0.62,
  },
  finishQuestButtonText: {
    color: "#fff",
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
  trophyRoom: {
    gap: 18,
  },
  trophyRoomHeader: {
    backgroundColor: palette.accentDark,
    borderRadius: 8,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.26)",
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.34,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  trophyRoomTitle: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  trophyRoomText: {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  trophyList: {
    gap: 14,
  },
  trophyCard: {
    backgroundColor: palette.paper,
    borderRadius: 8,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.shadow,
    shadowOpacity: 0.26,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  trophyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  trophyEmojiBadge: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  trophyEmoji: {
    fontSize: 28,
  },
  trophyTitleWrap: {
    flex: 1,
    gap: 4,
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
  trophyPreviewRow: {
    flexDirection: "row",
    gap: 10,
  },
  trophyPreview: {
    flex: 1,
    aspectRatio: 1.18,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.14)",
  },
  trophyPreviewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  trophyPreviewPlaceholder: {
    flex: 1,
    backgroundColor: "#fff",
  },
  trophyPreviewLabel: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: "rgba(40, 33, 48, 0.58)",
    color: "#fff",
    borderRadius: 6,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "900",
  },
  trophyEmptyPreview: {
    borderRadius: 8,
    backgroundColor: "rgba(237, 227, 255, 0.42)",
    padding: 14,
    minHeight: 70,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.border,
  },
  trophyEmptyPreviewText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  trophyStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trophyStatText: {
    color: palette.accent,
    fontSize: 14,
    fontWeight: "900",
    backgroundColor: palette.accentSoft,
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  trophyStatDivider: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "900",
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
  previewOverlay: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 70,
    paddingBottom: 40,
    backgroundColor: "transparent",
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
    justifyContent: "center",
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
  momentIconButtonPlaceholder: {
    width: 44,
    height: 44,
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
  deleteMomentButtonDisabled: {
    backgroundColor: palette.dangerSoft,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    opacity: 0.62,
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
