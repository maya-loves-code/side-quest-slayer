import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { CameraType } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
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
  type StyleProp,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";

import {
  DEFAULT_DAILY_REMINDER_TIME,
  addDemoEntry,
  addEntry,
  clearEntryCaption,
  completeQuest,
  createDemoQuest,
  createQuest,
  deleteAllAppData,
  deleteArchivedQuest,
  deleteEntry,
  getActiveQuests,
  getArchivedQuests,
  getDailyReminderEnabled,
  getDailyReminderTime,
  getEntriesForQuest,
  getJourneyPair,
  getLastOpenQuestId,
  initializeDatabase,
  setDailyReminderEnabled,
  setDailyReminderTime,
  setLastOpenQuestId,
  updateQuestEmoji,
} from "./src/lib/db";
import {
  getDailyInspiration,
  getLocalDateKey,
  getMillisecondsUntilNextLocalDay,
} from "./src/lib/dailyInspiration";
import { cancelDailyQuestReminder, scheduleDailyQuestReminder } from "./src/lib/notifications";
import {
  deleteAllStoredPhotos,
  deleteStoredPhoto,
  saveCapturedPhoto,
  saveDemoAssetPhoto,
  saveImportedPhoto,
} from "./src/lib/storage";
import { palette } from "./src/theme/colors";
import type { JournalEntry, Quest } from "./src/types";
import type { DemoQuestSeed } from "./src/dev/demoSeeds";

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

type FooterIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const EMOJI_OPTIONS = ["⚔️", "🎨", "💃", "💪", "🎓", "💻", "🎵", "✍️", "📷", "🌱", "🧵", "🛠️", "🎭", "🧠", "🏃‍♀️"];
const QUEST_TITLE_CHARACTER_LIMIT = 80;
const CAPTION_CHARACTER_LIMIT = 180;
const FOOTER_ICON_SIZE = 24;
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
const QUEST_IDEAS = [
  { emoji: "🍲", title: "Learn to cook" },
  { emoji: "📣", title: "Join a cheer team" },
  { emoji: "👟", title: "Run my first marathon" },
  { emoji: "🐶", title: "Raise a puppy" },
  { emoji: "🎸", title: "Learn guitar" },
  { emoji: "📓", title: "Write a book" },
  { emoji: "🚀", title: "Start my business" },
  { emoji: "📚", title: "Read 50 books" },
];
const ONBOARDING_QUEST_IMAGE = require("./assets/onboarding/quest-journey.png");

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function App() {
  const cameraRef = useRef<CameraView | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const importPreviewScrollRef = useRef<ScrollView | null>(null);
  const photoViewerProgress = useRef(new Animated.Value(0)).current;
  const { width, height } = useWindowDimensions();
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
  const [deletingArchivedQuest, setDeletingArchivedQuest] = useState(false);
  const [deletingAllData, setDeletingAllData] = useState(false);
  const [generatingDemoData, setGeneratingDemoData] = useState(false);
  const [schedulingReminder, setSchedulingReminder] = useState(false);
  const [dailyReminderEnabled, setDailyReminderEnabledState] = useState(false);
  const [dailyReminderTime, setDailyReminderTimeState] = useState(DEFAULT_DAILY_REMINDER_TIME);
  const [reminderTimeDraft, setReminderTimeDraft] = useState<string | null>(null);
  const [reminderTimePickerOpen, setReminderTimePickerOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [selectedMoment, setSelectedMoment] = useState<JournalEntry | null>(null);
  const [selectedMomentReadOnly, setSelectedMomentReadOnly] = useState(false);
  const [photoViewerUri, setPhotoViewerUri] = useState<string | null>(null);
  const [momentMenuOpen, setMomentMenuOpen] = useState(false);
  const [highlightedMomentId, setHighlightedMomentId] = useState<number | null>(null);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [scrapbookY, setScrapbookY] = useState(0);
  const [journeyPair, setJourneyPair] = useState<JourneyState>({ first: null, latest: null });
  const [archivedQuestView, setArchivedQuestView] = useState<ArchivedQuestView | null>(null);
  const [dailyInspirationDateKey, setDailyInspirationDateKey] = useState(() => getLocalDateKey());

  const activeEmoji = selectedQuest?.emoji ?? getQuestEmoji(selectedQuest?.title ?? "");
  const captionPlaceholder = REFLECTION_PROMPTS[reflectionPromptIndex];
  const pendingPreviewUri = pendingCaptureUri ?? pendingImportUri;
  const isPreviewingMoment = Boolean(pendingPreviewUri);
  const isPendingCapture = Boolean(pendingCaptureUri);
  const photoViewerBackdropOpacity = photoViewerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const photoViewerImageScale = photoViewerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });
  const photoViewerImageOpacity = photoViewerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const photoViewerZoomProps =
    Platform.OS === "ios"
      ? {
          maximumZoomScale: 4,
          minimumZoomScale: 1,
          centerContent: true,
          bouncesZoom: true,
        }
      : {};
  const momentSections = useMemo(() => createMomentSections(entries), [entries]);
  const archivedMomentSections = useMemo(
    () => createMomentSections(archivedQuestView?.entries ?? []),
    [archivedQuestView?.entries]
  );
  const momentTileWidth = Math.min(Math.floor((width - 96) / 2), 148);
  const previewPhotoMaxHeight = Math.max(230, height * 0.34);
  const previewPhotoMinHeight = Math.min(240, previewPhotoMaxHeight);
  const previewPhotoHeight = clamp(width * 0.7, previewPhotoMinHeight, previewPhotoMaxHeight);
  const displayedReminderTime = reminderTimeDraft ?? dailyReminderTime;
  const dailyReminderTimeLabel = useMemo(() => formatReminderTime(displayedReminderTime), [displayedReminderTime]);
  const dailyReminderPickerValue = useMemo(() => createReminderDate(displayedReminderTime), [displayedReminderTime]);
  const dailyInspiration = useMemo(() => getDailyInspiration(), [dailyInspirationDateKey]);
  const localDataOperationInProgress = deletingAllData || generatingDemoData;
  const isQuestOnboardingVisible = screen === "home" && !selectedQuest;
  const isActiveQuestScreenVisible = screen === "home" && Boolean(selectedQuest);
  const clearCelebration = useCallback(() => setHighlightedMomentId(null), []);

  useEffect(() => {
    void bootstrapApp();
  }, []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function refreshDailyInspiration() {
      setDailyInspirationDateKey(getLocalDateKey());
    }

    function scheduleDailyInspirationRefresh() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        refreshDailyInspiration();
        scheduleDailyInspirationRefresh();
      }, getMillisecondsUntilNextLocalDay());
    }

    scheduleDailyInspirationRefresh();

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        refreshDailyInspiration();
        scheduleDailyInspirationRefresh();
      }
    });

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      appStateSubscription.remove();
    };
  }, []);

  async function bootstrapApp() {
    try {
      await initializeDatabase();
      const [reminderEnabled, reminderTime] = await Promise.all([
        getDailyReminderEnabled(),
        getDailyReminderTime(),
      ]);
      setDailyReminderEnabledState(reminderEnabled);
      setDailyReminderTimeState(reminderTime);
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

  function handlePreviewCaptionFocus() {
    setTimeout(() => {
      importPreviewScrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }

  function openPhotoViewer(uri: string) {
    setMomentMenuOpen(false);
    photoViewerProgress.setValue(0);
    setPhotoViewerUri(uri);
    requestAnimationFrame(() => {
      Animated.timing(photoViewerProgress, {
        toValue: 1,
        duration: 280,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }

  function closePhotoViewer() {
    if (!photoViewerUri) {
      return;
    }

    Animated.timing(photoViewerProgress, {
      toValue: 0,
      duration: 240,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setPhotoViewerUri(null);
      }
    });
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
        closeReminderTimePicker();
        await cancelDailyQuestReminder();
        await setDailyReminderEnabled(false);
        setDailyReminderEnabledState(false);
        return;
      }

      const scheduled = await scheduleDailyQuestReminder(parseReminderTime(dailyReminderTime));

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

  async function handleReminderTimeChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === "android") {
      setReminderTimePickerOpen(false);
    }

    if (event.type === "dismissed") {
      closeReminderTimePicker();
      return;
    }

    if (!selectedDate || schedulingReminder) {
      return;
    }

    const nextTime = createReminderTimeString(selectedDate);

    if (Platform.OS === "ios") {
      setReminderTimeDraft(nextTime);
      return;
    }

    if (nextTime === dailyReminderTime) {
      closeReminderTimePicker();
      return;
    }

    await persistReminderTime(nextTime, dailyReminderEnabled);
    setReminderTimeDraft(null);
  }

  async function persistReminderTime(nextTime: string, reminderEnabled: boolean) {
    try {
      setSchedulingReminder(true);
      await setDailyReminderTime(nextTime);
      setDailyReminderTimeState(nextTime);

      if (!reminderEnabled) {
        return;
      }

      const scheduled = await scheduleDailyQuestReminder(parseReminderTime(nextTime));

      if (!scheduled) {
        await setDailyReminderEnabled(false);
        setDailyReminderEnabledState(false);
        Alert.alert("Notifications off", "You can enable notifications in your device settings when you want reminders.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Reminder error", "That reminder time did not save. Try one more time.");
    } finally {
      setSchedulingReminder(false);
    }
  }

  function openReminderTimePicker() {
    setReminderTimeDraft(dailyReminderTime);
    setReminderTimePickerOpen(true);
  }

  function closeReminderTimePicker() {
    setReminderTimePickerOpen(false);
    setReminderTimeDraft(null);
  }

  async function handleReminderTimeDone() {
    const nextTime = reminderTimeDraft ?? dailyReminderTime;
    closeReminderTimePicker();

    if (nextTime === dailyReminderTime) {
      return;
    }

    await persistReminderTime(nextTime, dailyReminderEnabled);
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

  function confirmDeleteArchivedQuest(summary: ArchivedQuestSummary) {
    if (deletingArchivedQuest) {
      return;
    }

    Alert.alert(
      "Delete Quest?",
      "This will permanently remove this completed quest from your Trophy Room.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void handleDeleteArchivedQuest(summary),
        },
      ]
    );
  }

  async function handleDeleteArchivedQuest(summary: ArchivedQuestSummary) {
    if (deletingArchivedQuest) {
      return;
    }

    try {
      setDeletingArchivedQuest(true);
      const questEntries = await getEntriesForQuest(summary.quest.id);

      await Promise.all(questEntries.map((entry) => deleteStoredPhoto(entry.imageUri)));
      await deleteArchivedQuest(summary.quest.id);

      if (archivedQuestView?.quest.id === summary.quest.id) {
        closeArchivedQuest();
      }

      await refreshData(selectedQuest?.id);
    } catch (error) {
      console.error(error);
      Alert.alert("Delete error", "That completed quest could not be deleted. Try one more time.");
    } finally {
      setDeletingArchivedQuest(false);
    }
  }

  function confirmDeleteAllData() {
    if (localDataOperationInProgress) {
      return;
    }

    Alert.alert(
      "Delete All Data?",
      "This will permanently delete all quests, photos, Trophy Room entries, reminders, and settings stored on this device. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All Data",
          style: "destructive",
          onPress: () => void handleDeleteAllData(),
        },
      ]
    );
  }

  async function handleDeleteAllData() {
    if (localDataOperationInProgress) {
      return;
    }

    try {
      setDeletingAllData(true);
      closeReminderTimePicker();
      await cancelDailyQuestReminder();
      await deleteAllStoredPhotos();
      await deleteAllAppData();

      resetAppStateAfterLocalDataClear();
    } catch (error) {
      console.error(error);
      Alert.alert("Delete error", "Your app data could not be deleted. Try one more time.");
    } finally {
      setDeletingAllData(false);
    }
  }

  function resetAppStateAfterLocalDataClear() {
    setScreen("home");
    setQuestTitle("");
    setActiveQuests([]);
    setSelectedQuest(null);
    setEntries([]);
    setArchivedQuests([]);
    setQuestPickerOpen(false);
    setNewQuestFormOpen(false);
    setCameraOpen(false);
    setCaptionDraft("");
    setPendingCaptureUri(null);
    setPendingImportUri(null);
    setDailyReminderEnabledState(false);
    setDailyReminderTimeState(DEFAULT_DAILY_REMINDER_TIME);
    setEmojiPickerOpen(false);
    setSelectedMoment(null);
    setSelectedMomentReadOnly(false);
    setMomentMenuOpen(false);
    setHighlightedMomentId(null);
    setJourneyPair({ first: null, latest: null });
    setArchivedQuestView(null);
  }

  function confirmGenerateDemoData() {
    if (localDataOperationInProgress) {
      return;
    }

    Alert.alert(
      "Generate Demo Data?",
      "This will replace local app data on this development build with a screenshot-ready Writer quest.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Generate",
          onPress: () => void handleGenerateDemoData(),
        },
      ]
    );
  }

  function confirmGenerateCompletedQuest() {
    if (localDataOperationInProgress) {
      return;
    }

    Alert.alert(
      "Generate Completed Quest?",
      "This will add a completed Poet quest to the Trophy Room on this development build.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Generate",
          onPress: () => void handleGenerateCompletedQuest(),
        },
      ]
    );
  }

  function confirmClearDemoData() {
    if (localDataOperationInProgress) {
      return;
    }

    Alert.alert(
      "Clear Demo Data?",
      "This will clear local quests, photos, reminders, and settings on this development build.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => void handleClearDemoData(),
        },
      ]
    );
  }

  async function handleGenerateDemoData() {
    if (localDataOperationInProgress) {
      return;
    }

    try {
      setGeneratingDemoData(true);
      closeReminderTimePicker();
      await cancelDailyQuestReminder();
      await deleteAllStoredPhotos();
      await deleteAllAppData();
      resetAppStateAfterLocalDataClear();

      const { WRITER_DEMO_QUEST } = loadDemoSeeds();
      const writerQuest = await createDemoQuestFromSeeds(WRITER_DEMO_QUEST);

      await setLastOpenQuestId(writerQuest.id);
      await refreshData(writerQuest.id);
    } catch (error) {
      console.error(error);
      Alert.alert("Demo error", "Demo data could not be generated. Try one more time.");
    } finally {
      setGeneratingDemoData(false);
    }
  }

  async function handleGenerateCompletedQuest() {
    if (localDataOperationInProgress) {
      return;
    }

    try {
      setGeneratingDemoData(true);
      const { POET_DEMO_QUEST } = loadDemoSeeds();
      await createDemoQuestFromSeeds(POET_DEMO_QUEST);

      setScreen("trophies");
      setArchivedQuestView(null);
      await refreshData(selectedQuest?.id);
    } catch (error) {
      console.error(error);
      Alert.alert("Demo error", "The completed demo quest could not be generated. Try one more time.");
    } finally {
      setGeneratingDemoData(false);
    }
  }

  async function handleClearDemoData() {
    if (localDataOperationInProgress) {
      return;
    }

    try {
      setGeneratingDemoData(true);
      closeReminderTimePicker();
      await cancelDailyQuestReminder();
      await deleteAllStoredPhotos();
      await deleteAllAppData();
      resetAppStateAfterLocalDataClear();
    } catch (error) {
      console.error(error);
      Alert.alert("Demo error", "Demo data could not be cleared. Try one more time.");
    } finally {
      setGeneratingDemoData(false);
    }
  }

  async function createDemoQuestFromSeeds(seed: DemoQuestSeed) {
    const quest = await createDemoQuest(seed);

    if (!quest) {
      throw new Error("Demo quest could not be created.");
    }

    for (const entry of seed.entries) {
      const source = Image.resolveAssetSource(entry.imageSource);

      if (!source?.uri) {
        throw new Error(`Missing demo image for ${entry.filename}.`);
      }

      const imageUri = await saveDemoAssetPhoto(source.uri, `quest-${quest.id}-${entry.filename}`);
      await addDemoEntry({
        questId: quest.id,
        imageUri,
        timestamp: entry.timestamp,
        isMilestone: entry.isMilestone ?? 0,
        caption: entry.caption,
      });
    }

    return quest;
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
              <View pointerEvents="none" style={styles.previewPaperBase} />
              <View pointerEvents="none" style={styles.previewPaperFleckOne} />
              <View pointerEvents="none" style={styles.previewPaperFleckTwo} />
              <View pointerEvents="none" style={styles.previewPaperFleckThree} />
            </>
          ) : null}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
            style={isPreviewingMoment ? styles.previewOverlay : styles.cameraOverlay}
          >
            <View style={[styles.cameraHeader, isPreviewingMoment ? styles.previewHeader : null]}>
              <Text style={[styles.cameraQuestTitle, isPreviewingMoment ? styles.previewQuestTitle : null]}>
                {activeEmoji} {selectedQuest?.title}
              </Text>
              <Pressable
                onPress={closeCamera}
                style={isPreviewingMoment ? styles.previewCloseButton : styles.cameraCloseButton}
                accessibilityLabel="Close camera"
              >
                <Text style={isPreviewingMoment ? styles.previewCloseText : styles.cameraCloseText}>×</Text>
              </Pressable>
            </View>
            {pendingPreviewUri ? (
              <View style={styles.importPreviewPanel}>
                <ScrollView
                  ref={importPreviewScrollRef}
                  style={styles.importPreviewScroll}
                  contentContainerStyle={styles.importPreviewScrollContent}
                  keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.importPreviewScrap}>
                    <View pointerEvents="none" style={styles.importPreviewTape} />
                    <DoodleMark variant="spark" style={styles.importPreviewDoodle} />
                    <View style={[styles.proofPhotoFrame, { height: previewPhotoHeight }]}>
                      <Image source={{ uri: pendingPreviewUri }} style={styles.proofPhotoImage} />
                    </View>
                  </View>
                  <View style={styles.previewCaptionCard}>
                    <TextInput
                      value={captionDraft}
                      onChangeText={setCaptionDraft}
                      onFocus={handlePreviewCaptionFocus}
                      placeholder={captionPlaceholder}
                      placeholderTextColor={palette.pencil}
                      style={styles.previewCaptionInput}
                      maxLength={CAPTION_CHARACTER_LIMIT}
                      multiline
                      editable={!savingPhoto && !importingPhoto}
                    />
                    <Text style={styles.previewCaptionCounter}>
                      {captionDraft.length}/{CAPTION_CHARACTER_LIMIT}
                    </Text>
                  </View>
                </ScrollView>
                <View style={styles.importPreviewActions}>
                  <Pressable
                    onPress={isPendingCapture ? cancelPendingCapture : cancelPendingImport}
                    style={savingPhoto ? styles.previewSecondaryButtonDisabled : styles.previewSecondaryButton}
                    disabled={savingPhoto}
                    accessibilityLabel={isPendingCapture ? "Retake photo" : "Choose another photo"}
                  >
                    <Text style={styles.previewSecondaryButtonText}>
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
                  <Text style={styles.previewStatusText}>{savingPhoto ? "Saving..." : " "}</Text>
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
          if (photoViewerUri) {
            closePhotoViewer();
            return;
          }

          setMomentMenuOpen(false);
          setSelectedMoment(null);
          setSelectedMomentReadOnly(false);
        }}
      >
        <View style={styles.momentScreen}>
          <View pointerEvents="none" style={styles.previewPaperBase} />
          <View pointerEvents="none" style={styles.previewPaperFleckOne} />
          <View pointerEvents="none" style={styles.previewPaperFleckTwo} />
          <View pointerEvents="none" style={styles.previewPaperFleckThree} />
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
                setPhotoViewerUri(null);
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
            <ScrollView
              style={styles.momentContentScroll}
              contentContainerStyle={styles.momentContent}
              showsVerticalScrollIndicator={false}
            >
              <Pressable
                onPress={() => openPhotoViewer(selectedMoment.imageUri)}
                style={styles.momentScrap}
                accessibilityRole="imagebutton"
                accessibilityLabel="Open full photo preview"
              >
                <View pointerEvents="none" style={styles.importPreviewTape} />
                <DoodleMark variant="spark" style={styles.momentDetailDoodle} />
                <View style={getMomentPhotoFrameStyle(selectedMoment.caption, height)}>
                  <Image source={{ uri: selectedMoment.imageUri }} style={styles.proofPhotoImage} />
                </View>
                <Text style={styles.momentPolaroidTimestamp}>{formatTimestamp(selectedMoment.timestamp)}</Text>
              </Pressable>
              {selectedMoment.caption?.trim() ? <MomentJournalEntry caption={selectedMoment.caption} /> : null}
            </ScrollView>
          ) : null}
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
          {photoViewerUri ? (
            <Animated.View style={[styles.photoViewerScreen, { opacity: photoViewerBackdropOpacity }]}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={closePhotoViewer}
                accessibilityLabel="Close full photo preview"
              />
              <View pointerEvents="none" style={styles.photoViewerGlowTop} />
              <View pointerEvents="none" style={styles.photoViewerGlowBottom} />
              <View pointerEvents="none" style={styles.photoViewerPaperFleckOne} />
              <View pointerEvents="none" style={styles.photoViewerPaperFleckTwo} />
              <SafeAreaView pointerEvents="box-none" style={styles.photoViewerSafeArea}>
                <Pressable
                  onPress={closePhotoViewer}
                  style={styles.photoViewerCloseButton}
                  accessibilityLabel="Close full photo preview"
                >
                  <Text style={styles.photoViewerCloseText}>×</Text>
                </Pressable>
                <Animated.View
                  style={[
                    styles.photoViewerStage,
                    {
                      opacity: photoViewerImageOpacity,
                      transform: [{ scale: photoViewerImageScale }],
                    },
                  ]}
                >
                  <ScrollView
                    style={[
                      styles.photoViewerScroll,
                      {
                        width: Math.max(300, width - 24),
                        height: Math.max(340, height - 132),
                      },
                    ]}
                    contentContainerStyle={styles.photoViewerScrollContent}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    {...photoViewerZoomProps}
                  >
                    <Image
                      source={{ uri: photoViewerUri }}
                      style={[styles.photoViewerImage, { width: Math.max(300, width - 24), height: Math.max(340, height - 132) }]}
                    />
                  </ScrollView>
                </Animated.View>
              </SafeAreaView>
            </Animated.View>
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
              style={[
                styles.questSheetList,
                { maxHeight: Math.min(430, Math.max(320, height * 0.48)) },
              ]}
              contentContainerStyle={styles.questSheetListContent}
              showsVerticalScrollIndicator={false}
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

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.container,
          isQuestOnboardingVisible ? styles.onboardingScrollContainer : null,
          isActiveQuestScreenVisible ? styles.activeQuestScrollContainer : null,
        ]}
      >
        <View pointerEvents="none" style={styles.paperTexture}>
          <View style={styles.paperFleckOne} />
          <View style={styles.paperFleckTwo} />
          <View style={styles.paperFleckThree} />
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

              <View style={styles.questHeroScrap}>
                <TapeLabel label="Active Quest" rotate="-3deg" />
                <DoodleMark variant="spark" style={styles.heroSparkDoodle} />
                <View style={styles.questHeroRow}>
                  <Pressable onPress={() => setEmojiPickerOpen(true)} style={styles.questEmojiButton}>
                    <View pointerEvents="none" style={styles.questEmojiTape} />
                    <Text style={styles.questEmoji}>{activeEmoji}</Text>
                  </Pressable>
                  <View style={styles.questTitleWrap}>
                    <Text style={styles.questTitle}>{selectedQuest.title}</Text>
                    <Text style={styles.momentCount}>
                      {entries.length === 0
                        ? "New quest unlocked."
                        : `${entries.length} ${entries.length === 1 ? "step" : "steps"} into your quest`}
                    </Text>
                  </View>
                </View>
                <DailyInspirationText message={dailyInspiration.message} />
              </View>

              <Pressable onPress={openCamera} style={styles.logStepCard} accessibilityLabel="Open camera">
                <View pointerEvents="none" style={styles.logStepPaperGrain} />
                <View pointerEvents="none" style={styles.logStepTape} />
                <View style={styles.logStepIconWrap}>
                  <CameraGlyph />
                </View>
                <View style={styles.logStepCopy}>
                  <Text style={styles.logStepTitle}>Log Today's Step</Text>
                  <Text style={styles.logStepText}>Add your daily proof. Future you will be glad you did.</Text>
                </View>
                <Text style={styles.logStepArrow}>›</Text>
              </Pressable>

              <View
                onLayout={(event) => setScrapbookY(event.nativeEvent.layout.y)}
                style={styles.scrapbookArea}
              >
                <ScrapbookHeader title="Your Journey" />
                {entries.length === 0 ? (
                  <View style={styles.emptyScrapbookState}>
                    <DoodleMark variant="star" style={styles.emptyStateStar} />
                    <Text style={styles.emptyTitle}>No steps yet</Text>
                    <Text style={styles.sectionText}>Log today's step to begin your journey.</Text>
                    <AddTodayTile tileWidth={momentTileWidth} onPress={openCamera} />
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
                          {section === momentSections[0] ? (
                            <AddTodayTile tileWidth={momentTileWidth} onPress={openCamera} />
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                {entries.length > 0 ? <Text style={styles.chainNote}>Keep the chain going</Text> : null}
              </View>

              <View style={styles.journeyCard}>
                <ScrapbookHeader title="From Then to Now" note="Look how far you have come." />
                <View style={styles.bridgeRow}>
                  <JourneyPanel label="Day 1" entry={journeyPair.first} onPress={openMoment} />
                  <JourneyPanel label="Latest" entry={journeyPair.latest} onPress={openMoment} />
                </View>
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
            <ChooseQuestOnboarding
              questTitle={questTitle}
              creatingQuest={creatingQuest}
              onQuestTitleChange={setQuestTitle}
              onChooseIdea={setQuestTitle}
              onCreateQuest={handleCreateQuest}
            />
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
                {archivedQuestView.entries.length > 0 ? (
                  <RecapStat
                    label="Steps"
                    value={`${archivedQuestView.entries.length}`}
                  />
                ) : null}
                <RecapStat label="Started" value={formatDate(archivedQuestView.quest.startedAt)} />
                <RecapStat label="Finished" value={formatDate(archivedQuestView.quest.completedAt)} />
                <RecapStat label="Duration" value={archivedQuestView.durationLabel} />
              </View>
            </View>

            {archivedQuestView.entries.length > 0 ? (
              <View style={styles.journeyCard}>
                <Text style={styles.sectionTitle}>From Then to Now</Text>
                <View style={styles.bridgeRow}>
                  <JourneyPanel label="First Step" entry={archivedQuestView.firstEntry} onPress={(entry) => openMoment(entry, true)} />
                  <JourneyPanel label="Latest Step" entry={archivedQuestView.latestEntry} onPress={(entry) => openMoment(entry, true)} />
                </View>
              </View>
            ) : null}

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
                  <Text style={styles.emptyTitle}>Quest complete</Text>
                  <Text style={styles.sectionText}>This finished quest is saved in your Trophy Room.</Text>
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
                <Text style={styles.sectionText}>Finish a quest to save it here.</Text>
              </View>
            ) : (
              <View style={styles.trophyList}>
                {archivedQuests.map((questSummary) => (
                  <TrophyCard
                    key={questSummary.quest.id}
                    summary={questSummary}
                    onPress={() => openArchivedQuest(questSummary)}
                    onDelete={() => confirmDeleteArchivedQuest(questSummary)}
                    deleteDisabled={deletingArchivedQuest}
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

            <View style={[styles.settingsSection, styles.settingsReminderSection]}>
              <Pressable
                onPress={() => handleSetDailyReminder(!dailyReminderEnabled)}
                style={styles.settingsControlRow}
                disabled={schedulingReminder}
                accessibilityRole="switch"
                accessibilityState={{ checked: dailyReminderEnabled, disabled: schedulingReminder }}
                accessibilityLabel="Daily Reminder"
              >
                <View style={styles.settingsRowText}>
                  <Text style={styles.settingsSectionTitle}>Daily Reminder</Text>
                  <Text style={styles.settingsText}>A reminder to capture today’s progress.</Text>
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
              {dailyReminderEnabled ? (
                <>
                  <Pressable
                    onPress={openReminderTimePicker}
                    style={[styles.settingsTimeRow, schedulingReminder ? styles.settingsTimeRowDisabled : null]}
                    disabled={schedulingReminder}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: schedulingReminder }}
                    accessibilityLabel={`Reminder Time, ${dailyReminderTimeLabel}`}
                  >
                    <Text style={styles.settingsSectionTitle}>Reminder Time</Text>
                    <View style={styles.settingsTimeValueWrap}>
                      <Text style={styles.settingsTimeValue}>{dailyReminderTimeLabel}</Text>
                      <Text style={styles.settingsRowArrow}>›</Text>
                    </View>
                  </Pressable>
                  {reminderTimePickerOpen ? (
                    <View style={styles.settingsTimePickerWrap}>
                      <DateTimePicker
                        value={dailyReminderPickerValue}
                        mode="time"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        onChange={handleReminderTimeChange}
                        disabled={schedulingReminder}
                      />
                      {Platform.OS === "ios" ? (
                        <View style={styles.settingsTimePickerActions}>
                          <Pressable
                            onPress={closeReminderTimePicker}
                            style={styles.secondaryButton}
                            disabled={schedulingReminder}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: schedulingReminder }}
                            accessibilityLabel="Cancel reminder time"
                          >
                            <Text style={styles.secondaryButtonText}>Cancel</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => void handleReminderTimeDone()}
                            style={schedulingReminder ? styles.primaryButtonDisabled : styles.primaryButton}
                            disabled={schedulingReminder}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: schedulingReminder }}
                            accessibilityLabel="Save reminder time"
                          >
                            <Text style={styles.primaryButtonText}>Done</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </>
              ) : null}
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

            {__DEV__ ? (
              <View style={styles.demoSection}>
                <Text style={styles.settingsSectionTitle}>Demo Tools</Text>
                <Text style={styles.settingsText}>
                  Development-only data for screenshots, testing, and marketing assets.
                </Text>
                <Pressable
                  onPress={confirmGenerateDemoData}
                  style={localDataOperationInProgress ? styles.demoButtonDisabled : styles.demoButton}
                  disabled={localDataOperationInProgress}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: localDataOperationInProgress }}
                  accessibilityLabel="Generate Demo Data"
                >
                  <Text style={styles.demoButtonText}>
                    {generatingDemoData ? "Working..." : "Generate Demo Data"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={confirmGenerateCompletedQuest}
                  style={localDataOperationInProgress ? styles.demoButtonDisabled : styles.demoButton}
                  disabled={localDataOperationInProgress}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: localDataOperationInProgress }}
                  accessibilityLabel="Generate Completed Quest"
                >
                  <Text style={styles.demoButtonText}>Generate Completed Quest</Text>
                </Pressable>
                <Pressable
                  onPress={confirmClearDemoData}
                  style={localDataOperationInProgress ? styles.demoDangerButtonDisabled : styles.demoDangerButton}
                  disabled={localDataOperationInProgress}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: localDataOperationInProgress }}
                  accessibilityLabel="Clear Demo Data"
                >
                  <Text style={styles.demoDangerButtonText}>Clear Demo Data</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.dangerSection}>
              <Text style={styles.dangerSectionTitle}>Danger Zone</Text>
              <Text style={styles.settingsRowTitle}>Delete All Data</Text>
              <Text style={styles.settingsText}>
                Remove all quests, photos, Trophy Room entries, reminders, and settings stored on this device.
              </Text>
              <Pressable
                onPress={confirmDeleteAllData}
                style={localDataOperationInProgress ? styles.dangerButtonDisabled : styles.dangerButton}
                disabled={localDataOperationInProgress}
                accessibilityRole="button"
                accessibilityState={{ disabled: localDataOperationInProgress }}
                accessibilityLabel="Delete All Data"
              >
                <Text style={styles.dangerButtonText}>{deletingAllData ? "Deleting..." : "Delete All Data"}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
      {highlightedMomentId !== null && screen === "home" ? (
        <CelebrationOverlay key={celebrationKey} onDone={clearCelebration} />
      ) : null}
      <View style={styles.bottomNav}>
        <BottomNavItem
          label="Quest"
          active={screen === "home"}
          activeIcon="shield-sword"
          inactiveIcon="shield-sword-outline"
          onPress={() => {
            setScreen("home");
            setArchivedQuestView(null);
          }}
        />
        <BottomNavItem
          label="Trophy Room"
          active={screen === "trophies"}
          activeIcon="trophy"
          inactiveIcon="trophy-outline"
          onPress={() => {
            setScreen("trophies");
            setArchivedQuestView(null);
          }}
        />
        <BottomNavItem
          label="Settings"
          active={screen === "settings"}
          activeIcon="cog"
          inactiveIcon="cog-outline"
          onPress={() => {
            setScreen("settings");
            setArchivedQuestView(null);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

function BottomNavItem({
  label,
  active,
  activeIcon,
  inactiveIcon,
  onPress,
}: {
  label: string;
  active: boolean;
  activeIcon: FooterIconName;
  inactiveIcon: FooterIconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={active ? styles.navItemActive : styles.navItem}
    >
      <View style={styles.navIconSlot}>
        <MaterialCommunityIcons
          name={active ? activeIcon : inactiveIcon}
          size={FOOTER_ICON_SIZE}
          color={active ? palette.accent : palette.muted}
        />
      </View>
      <Text style={active ? styles.navTextActive : styles.navText}>{label}</Text>
    </Pressable>
  );
}

function TapeLabel({ label, rotate = "-2deg" }: { label: string; rotate?: string }) {
  return (
    <View style={[styles.tapeLabel, { transform: [{ rotate }] }]}>
      <View style={styles.tapeTornEdgeLeft} />
      <Text style={styles.tapeLabelText}>{label}</Text>
      <View style={styles.tapeTornEdgeRight} />
    </View>
  );
}

function ScrapbookHeader({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.scrapbookHeader}>
      <TapeLabel label={title} rotate="-1.5deg" />
      {note ? <Text style={styles.scrapbookHeaderNote}>{note}</Text> : null}
    </View>
  );
}

function DoodleMark({ variant, style }: { variant: "arrow" | "spark" | "star" | "swirl"; style?: StyleProp<ViewStyle> }) {
  const text = variant === "arrow" ? "↘" : variant === "spark" ? "✶" : variant === "star" ? "☆" : "↝";

  return (
    <View
      pointerEvents="none"
      style={[styles.doodleMark, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={styles.doodleText}>{text}</Text>
    </View>
  );
}

function CameraGlyph() {
  return (
    <View style={styles.cameraGlyph}>
      <View style={styles.cameraGlyphTop} />
      <View style={styles.cameraGlyphLens} />
      <View style={styles.cameraGlyphFlash} />
    </View>
  );
}

function AddTodayTile({ tileWidth, onPress }: { tileWidth: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.addTodayTile, { width: tileWidth }]}
      accessibilityLabel="Add today's step"
    >
      <View style={styles.addTodayTape} />
      <Text style={styles.addTodayIcon}>＋</Text>
      <Text style={styles.addTodayText}>Add Today's Step</Text>
    </Pressable>
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
  const placeholderText = label.toLowerCase().includes("latest")
    ? "Your latest step will show here"
    : "Your first step will show here";

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
          <Text style={styles.placeholderText}>{placeholderText}</Text>
        </View>
      )}
    </View>
  );
}

function TrophyCard({
  summary,
  onPress,
  onDelete,
  deleteDisabled,
}: {
  summary: ArchivedQuestSummary;
  onPress: () => void;
  onDelete: () => void;
  deleteDisabled: boolean;
}) {
  const emoji = summary.quest.emoji ?? getQuestEmoji(summary.quest.title);
  const hasEntries = summary.entries.length > 0;
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
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          style={styles.trophyDeleteButton}
          disabled={deleteDisabled}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Delete Quest"
          accessibilityState={{ disabled: deleteDisabled }}
        >
          <MaterialCommunityIcons name="dots-horizontal" size={22} color={palette.ink} />
        </Pressable>
      </View>

      {hasEntries ? (
        <>
          <View style={styles.trophyPreviewRow}>
            <TrophyPreview label="First" entry={summary.firstEntry} />
            <TrophyPreview label="Latest" entry={summary.latestEntry} />
          </View>

          <View style={styles.trophyStatsRow}>
            <Text style={styles.trophyStatText}>{stepLabel}</Text>
            <Text style={styles.trophyStatDivider}>•</Text>
            <Text style={styles.trophyStatText}>{summary.durationLabel}</Text>
          </View>
        </>
      ) : null}
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

function ChooseQuestOnboarding({
  questTitle,
  creatingQuest,
  onQuestTitleChange,
  onChooseIdea,
  onCreateQuest,
}: {
  questTitle: string;
  creatingQuest: boolean;
  onQuestTitleChange: (title: string) => void;
  onChooseIdea: (title: string) => void;
  onCreateQuest: () => void;
}) {
  return (
    <View style={styles.questOnboarding}>
      <View style={styles.questOnboardingHero}>
        <View style={styles.questOnboardingCopy}>
          <Text
            style={styles.questOnboardingBurst}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            ✦
          </Text>
          <Text style={styles.questOnboardingTitle}>
            Choose{"\n"}
            <Text style={styles.questOnboardingTitleAccent}>Your Quest</Text>
          </Text>
          <Text style={styles.questOnboardingIntro}>
            What do you want to work toward? Build a visual record of{" "}
            your <Text style={styles.questOnboardingUnderline}>unique journey.</Text>
          </Text>
        </View>

        <View style={styles.questPolaroid}>
          <View pointerEvents="none" style={styles.questPolaroidTape} />
          <Text
            pointerEvents="none"
            style={styles.questPolaroidStar}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            ☆
          </Text>
          <Image source={ONBOARDING_QUEST_IMAGE} style={styles.questPolaroidImage} />
          <Text style={styles.questPolaroidCaption}>find joy in{"\n"}the journey ♡</Text>
        </View>
      </View>

      <View style={styles.questOnboardingFormCard}>
        <Text style={styles.questOnboardingFormTitle}>
          What’s your quest?{" "}
          <Text
            style={styles.questFormSpark}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            ✧
          </Text>
        </Text>
        <TextInput
          value={questTitle}
          onChangeText={onQuestTitleChange}
          placeholder="e.g. Build an app"
          placeholderTextColor="rgba(95, 86, 104, 0.48)"
          style={styles.questOnboardingInput}
          maxLength={QUEST_TITLE_CHARACTER_LIMIT}
          editable={!creatingQuest}
          returnKeyType="done"
        />
        <View style={styles.questOnboardingHelperRow}>
          <Text
            style={styles.questOnboardingArrow}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            ↝
          </Text>
          <Text style={styles.questOnboardingHelper}>Be specific or keep it simple.{"\n"}This is your journey.</Text>
        </View>

        <View pointerEvents="none" style={styles.questFormTape} />
        <Text style={styles.questIdeasTitle}>Need ideas? Here are a few:</Text>
        <View style={styles.questIdeaGrid}>
          {QUEST_IDEAS.map((idea) => (
            <Pressable
              key={idea.title}
              onPress={() => onChooseIdea(idea.title)}
              style={styles.questIdeaChip}
              disabled={creatingQuest}
              accessibilityRole="button"
              accessibilityLabel={`Use quest idea ${idea.title}`}
            >
              <Text style={styles.questIdeaEmoji}>{idea.emoji}</Text>
              <Text style={styles.questIdeaText}>{idea.title}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.questCreateOwn}>Or create your own. Anything that matters to you. ♡</Text>
      </View>

      <Pressable
        onPress={onCreateQuest}
        style={creatingQuest ? styles.questOnboardingButtonDisabled : styles.questOnboardingButton}
        disabled={creatingQuest}
        accessibilityRole="button"
        accessibilityLabel={creatingQuest ? "Starting quest" : "Start my quest"}
      >
        <Text style={styles.questOnboardingButtonText}>{creatingQuest ? "Starting..." : "Start My Quest"}</Text>
        <Text
          style={styles.questOnboardingButtonArrow}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          →
        </Text>
      </Pressable>

      <View style={styles.questOnboardingFooter}>
        <View style={styles.questFooterIconWrap}>
          <View style={styles.questFooterPolaroidBack}>
            <View style={styles.questFooterPolaroidPhoto} />
          </View>
          <View style={styles.questFooterPolaroidFront}>
            <View style={styles.questFooterPolaroidPhoto} />
          </View>
        </View>
        <View style={styles.questFooterCopy}>
          <Text style={styles.questFooterTitle}>You can have multiple quests.</Text>
          <Text style={styles.questFooterText}>
            Focus on one today, switch <Text style={styles.questFooterUnderline}>anytime.</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

function DailyInspirationText({ message }: { message: string }) {
  const fadeProgress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fadeProgress.setValue(0);
    Animated.timing(fadeProgress, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fadeProgress, message]);

  return (
    <Animated.Text style={[styles.questIdentityNote, { opacity: fadeProgress }]}>
      {message}
    </Animated.Text>
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
  const isTall = index > 2 && index % 5 === 0;
  const rotation = getScrapRotation(index);

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
        { width: tileWidth, transform: [{ rotate: rotation }, { scale }] },
      ]}
    >
      <Pressable onPress={onPress} style={styles.momentTileButton}>
        <View pointerEvents="none" style={styles.photoTape} />
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

function MomentJournalEntry({ caption }: { caption: string | null }) {
  const trimmedCaption = caption?.trim() ?? "";

  return (
    <View style={styles.momentJournalEntry}>
      <Text style={styles.momentJournalText}>{trimmedCaption}</Text>
    </View>
  );
}

function loadDemoSeeds() {
  if (!__DEV__) {
    throw new Error("Demo seeds are only available in development builds.");
  }

  return require("./src/dev/demoSeeds") as typeof import("./src/dev/demoSeeds");
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

function getMomentPhotoFrameStyle(caption: string | null, viewportHeight: number) {
  const captionLength = caption?.trim().length ?? 0;

  if (captionLength === 0) {
    return [styles.proofPhotoFrame, { height: getResponsiveMomentImageHeight(viewportHeight, 0.64, 310, 570) }];
  }

  if (captionLength <= 45) {
    return [styles.proofPhotoFrame, { height: getResponsiveMomentImageHeight(viewportHeight, 0.53, 265, 480) }];
  }

  if (captionLength <= 120) {
    return [styles.proofPhotoFrame, { height: getResponsiveMomentImageHeight(viewportHeight, 0.48, 245, 435) }];
  }

  return [styles.proofPhotoFrame, { height: getResponsiveMomentImageHeight(viewportHeight, 0.42, 225, 390) }];
}

function getResponsiveMomentImageHeight(viewportHeight: number, ratio: number, preferredMin: number, max: number) {
  const responsiveMax = Math.min(max, Math.max(220, viewportHeight - 210));
  const effectiveMin = Math.min(preferredMin, responsiveMax);
  return clamp(viewportHeight * ratio, effectiveMin, responsiveMax);
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

function getScrapRotation(index: number) {
  const rotations = ["-2.5deg", "1.6deg", "-0.8deg", "2.4deg", "-1.4deg", "0.9deg"];
  return rotations[index % rotations.length];
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function parseReminderTime(time: string) {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return parseReminderTime(DEFAULT_DAILY_REMINDER_TIME);
  }

  return { hour, minute };
}

function createReminderDate(time: string) {
  const { hour, minute } = parseReminderTime(time);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function createReminderTimeString(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatReminderTime(time: string) {
  return createReminderDate(time).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
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
    position: "relative",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 168,
    gap: 18,
  },
  onboardingScrollContainer: {
    paddingBottom: 96,
  },
  activeQuestScrollContainer: {
    paddingBottom: 104,
  },
  paperTexture: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  paperFleckOne: {
    position: "absolute",
    width: 138,
    height: 138,
    borderRadius: 69,
    backgroundColor: palette.paperFleck,
    right: -72,
    top: 118,
    opacity: 0.22,
  },
  paperFleckTwo: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(124, 58, 237, 0.035)",
    left: -52,
    top: 310,
  },
  paperFleckThree: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(233, 217, 183, 0.16)",
    right: -96,
    bottom: 220,
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
  questOnboarding: {
    gap: 16,
    paddingTop: 12,
    paddingBottom: 0,
    overflow: "hidden",
  },
  questOnboardingHero: {
    minHeight: 0,
    gap: 14,
  },
  questOnboardingCopy: {
    paddingHorizontal: 18,
    paddingTop: 48,
    gap: 12,
  },
  questOnboardingBurst: {
    position: "absolute",
    left: 2,
    top: 22,
    color: palette.accent,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "600",
    opacity: 0.82,
    transform: [{ rotate: "-10deg" }],
  },
  questOnboardingTitle: {
    color: palette.ink,
    fontSize: 48,
    lineHeight: 50,
    fontWeight: "900",
    letterSpacing: 0,
  },
  questOnboardingTitleAccent: {
    color: palette.accentDark,
  },
  questOnboardingIntro: {
    color: palette.ink,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: "500",
    maxWidth: 330,
  },
  questOnboardingUnderline: {
    color: palette.accentDark,
    textDecorationLine: "underline",
    textDecorationColor: palette.accent,
  },
  questPolaroid: {
    width: 222,
    alignSelf: "center",
    backgroundColor: palette.photoPaper,
    padding: 12,
    paddingBottom: 20,
    marginTop: 0,
    shadowColor: palette.shadow,
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  questPolaroidTape: {
    position: "absolute",
    top: -12,
    alignSelf: "center",
    width: 84,
    height: 18,
    backgroundColor: "rgba(233, 217, 183, 0.68)",
    borderRadius: 2,
    zIndex: 3,
    transform: [{ rotate: "-2deg" }],
  },
  questPolaroidStar: {
    position: "absolute",
    left: -16,
    top: 10,
    zIndex: 4,
    color: "rgba(124, 58, 237, 0.58)",
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "400",
    transform: [{ rotate: "-12deg" }],
  },
  questPolaroidImage: {
    width: "100%",
    height: 166,
    resizeMode: "cover",
  },
  questPolaroidCaption: {
    color: palette.ink,
    fontSize: 18,
    lineHeight: 26,
    fontStyle: "italic",
    fontWeight: "500",
    paddingTop: 14,
    textAlign: "center",
    transform: [{ rotate: "-2deg" }],
  },
  questOnboardingFormCard: {
    position: "relative",
    backgroundColor: "rgba(251, 248, 255, 0.76)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.14)",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 12,
    shadowColor: palette.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  questOnboardingFormTitle: {
    color: palette.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
  },
  questFormSpark: {
    color: "rgba(124, 58, 237, 0.48)",
    fontSize: 28,
  },
  questOnboardingInput: {
    minHeight: 68,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "rgba(124, 58, 237, 0.42)",
    backgroundColor: "rgba(255, 254, 249, 0.84)",
    paddingHorizontal: 18,
    color: palette.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
  },
  questOnboardingHelperRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingLeft: 34,
  },
  questOnboardingArrow: {
    color: "rgba(124, 58, 237, 0.48)",
    fontSize: 30,
    lineHeight: 34,
    transform: [{ rotate: "28deg" }],
  },
  questOnboardingHelper: {
    color: palette.accentDark,
    fontSize: 16,
    lineHeight: 25,
    fontStyle: "italic",
    fontWeight: "500",
  },
  questFormTape: {
    position: "absolute",
    right: -18,
    top: 306,
    width: 106,
    height: 20,
    backgroundColor: "rgba(188, 155, 255, 0.48)",
    borderRadius: 2,
    transform: [{ rotate: "11deg" }],
  },
  questIdeasTitle: {
    color: palette.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    marginTop: 10,
  },
  questIdeaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  questIdeaChip: {
    width: "48%",
    minHeight: 60,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.13)",
    backgroundColor: "rgba(255, 254, 249, 0.62)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    shadowColor: palette.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  questIdeaEmoji: {
    width: 24,
    fontSize: 19,
    textAlign: "center",
  },
  questIdeaText: {
    flex: 1,
    color: palette.accentDark,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  questCreateOwn: {
    color: palette.accentDark,
    fontSize: 15,
    lineHeight: 22,
    fontStyle: "italic",
    fontWeight: "500",
    textAlign: "center",
    paddingTop: 4,
  },
  questOnboardingButton: {
    minHeight: 78,
    borderRadius: 8,
    backgroundColor: palette.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 48,
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.36,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  questOnboardingButtonDisabled: {
    minHeight: 78,
    borderRadius: 8,
    backgroundColor: "rgba(124, 58, 237, 0.62)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 48,
    opacity: 0.68,
  },
  questOnboardingButtonText: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
  },
  questOnboardingButtonArrow: {
    color: "#fff",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "300",
  },
  questOnboardingFooter: {
    position: "relative",
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  questFooterIconWrap: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "rgba(124, 58, 237, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  questFooterPolaroidBack: {
    position: "absolute",
    width: 31,
    height: 38,
    borderRadius: 4,
    backgroundColor: palette.photoPaper,
    borderWidth: 2,
    borderColor: "rgba(124, 58, 237, 0.62)",
    padding: 4,
    paddingBottom: 10,
    shadowColor: palette.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    transform: [{ translateX: -7 }, { translateY: -5 }, { rotate: "-9deg" }],
  },
  questFooterPolaroidFront: {
    position: "absolute",
    width: 31,
    height: 38,
    borderRadius: 4,
    backgroundColor: palette.photoPaper,
    borderWidth: 2,
    borderColor: palette.accentDark,
    padding: 4,
    paddingBottom: 10,
    shadowColor: palette.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    transform: [{ translateX: 7 }, { translateY: 4 }, { rotate: "10deg" }],
  },
  questFooterPolaroidPhoto: {
    flex: 1,
    borderRadius: 2,
    backgroundColor: "rgba(124, 58, 237, 0.16)",
  },
  questFooterCopy: {
    flex: 1,
    gap: 2,
    zIndex: 2,
  },
  questFooterTitle: {
    color: palette.ink,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
  },
  questFooterText: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
  questFooterUnderline: {
    textDecorationLine: "underline",
    textDecorationColor: palette.accent,
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
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginBottom: -4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 254, 249, 0.74)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.11)",
  },
  currentQuestSelectorText: {
    flexShrink: 1,
    color: palette.pencil,
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
  tapeLabel: {
    alignSelf: "flex-start",
    minHeight: 34,
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: palette.lavenderTape,
    borderRadius: 2,
    shadowColor: palette.shadow,
    shadowOpacity: 0.32,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  tapeTornEdgeLeft: {
    position: "absolute",
    left: -4,
    top: 5,
    bottom: 5,
    width: 7,
    backgroundColor: "rgba(255, 250, 240, 0.42)",
  },
  tapeTornEdgeRight: {
    position: "absolute",
    right: -4,
    top: 6,
    bottom: 4,
    width: 7,
    backgroundColor: "rgba(255, 250, 240, 0.36)",
  },
  tapeLabelText: {
    color: palette.accentDark,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  scrapbookHeader: {
    gap: 10,
  },
  scrapbookHeaderNote: {
    color: palette.pencil,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    fontWeight: "600",
    paddingLeft: 4,
  },
  doodleMark: {
    position: "absolute",
    zIndex: 2,
  },
  doodleText: {
    color: palette.lavenderTapeDark,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
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
  settingsReminderSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 18,
    minHeight: 138,
  },
  demoSection: {
    backgroundColor: "#f3f7ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c9d8ff",
    padding: 16,
    gap: 12,
  },
  dangerSection: {
    backgroundColor: "#fff8f7",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.dangerBorder,
    padding: 16,
    gap: 12,
  },
  settingsSectionTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  dangerSectionTitle: {
    color: palette.danger,
    fontSize: 17,
    fontWeight: "900",
  },
  settingsText: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  settingsControlRow: {
    minHeight: 90,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  settingsTimeRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 16,
  },
  settingsTimeRowDisabled: {
    opacity: 0.58,
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
    gap: 6,
  },
  settingsRowTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  settingsTimeValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  settingsTimePickerWrap: {
    gap: 12,
  },
  settingsTimePickerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  settingsTimeValue: {
    color: palette.accent,
    fontSize: 15,
    fontWeight: "900",
  },
  settingsRowArrow: {
    color: palette.muted,
    fontSize: 24,
    fontWeight: "600",
    lineHeight: 26,
  },
  demoButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  demoButtonDisabled: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
    opacity: 0.58,
  },
  demoButtonText: {
    color: palette.accent,
    fontSize: 14,
    fontWeight: "900",
  },
  demoDangerButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.danger,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "transparent",
  },
  demoDangerButtonDisabled: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.dangerBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "transparent",
    opacity: 0.58,
  },
  demoDangerButtonText: {
    color: palette.danger,
    fontSize: 14,
    fontWeight: "900",
  },
  dangerButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.danger,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "transparent",
  },
  dangerButtonDisabled: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.dangerBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "transparent",
    opacity: 0.58,
  },
  dangerButtonText: {
    color: palette.danger,
    fontSize: 14,
    fontWeight: "900",
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
  trophyDeleteButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
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
    justifyContent: "flex-start",
    paddingHorizontal: 18,
    paddingTop: 70,
    paddingBottom: 22,
    backgroundColor: "transparent",
    gap: 18,
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
    alignItems: "center",
    justifyContent: "center",
  },
  cameraCloseText: {
    color: "#fff",
    fontSize: 30,
    lineHeight: 32,
    fontWeight: "700",
    textShadowColor: "rgba(0, 0, 0, 0.26)",
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  cameraQuestTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
  },
  previewPaperBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.paper,
  },
  previewPaperFleckOne: {
    position: "absolute",
    width: 150,
    height: 150,
    left: -48,
    top: 138,
    borderRadius: 75,
    backgroundColor: palette.paperFleck,
    opacity: 0.58,
  },
  previewPaperFleckTwo: {
    position: "absolute",
    width: 190,
    height: 190,
    right: -72,
    top: 318,
    borderRadius: 95,
    backgroundColor: "rgba(124, 58, 237, 0.07)",
  },
  previewPaperFleckThree: {
    position: "absolute",
    width: 140,
    height: 140,
    left: 34,
    bottom: 84,
    borderRadius: 70,
    backgroundColor: "rgba(216, 199, 255, 0.16)",
  },
  previewHeader: {
    paddingHorizontal: 2,
  },
  previewQuestTitle: {
    color: palette.ink,
  },
  previewCloseButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCloseText: {
    color: palette.ink,
    fontSize: 30,
    lineHeight: 32,
    fontWeight: "800",
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
    flex: 1,
    width: "100%",
    minHeight: 0,
    gap: 12,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  importPreviewScroll: {
    width: "100%",
    flex: 1,
    minHeight: 0,
  },
  importPreviewScrollContent: {
    gap: 14,
    paddingTop: 8,
    paddingBottom: 96,
  },
  importPreviewScrap: {
    width: "100%",
    backgroundColor: palette.photoPaper,
    borderRadius: 4,
    padding: 8,
    paddingBottom: 22,
    shadowColor: palette.shadow,
    shadowOpacity: 0.42,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    transform: [{ rotate: "-1.2deg" }],
  },
  importPreviewTape: {
    position: "absolute",
    top: -9,
    alignSelf: "center",
    width: 72,
    height: 18,
    borderRadius: 2,
    backgroundColor: "rgba(233, 217, 183, 0.82)",
    zIndex: 3,
    transform: [{ rotate: "2deg" }],
  },
  importPreviewDoodle: {
    right: 12,
    bottom: 4,
    opacity: 0.32,
    transform: [{ rotate: "12deg" }],
  },
  proofPhotoFrame: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: palette.photoPaper,
    alignItems: "center",
    justifyContent: "center",
  },
  proofPhotoImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  previewCaptionCard: {
    width: "100%",
    minHeight: 112,
    backgroundColor: "rgba(255, 254, 249, 0.9)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.16)",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8,
    shadowColor: palette.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  previewCaptionInput: {
    minHeight: 62,
    maxHeight: 98,
    color: palette.ink,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    padding: 0,
    textAlignVertical: "top",
  },
  previewCaptionCounter: {
    color: palette.pencil,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  importPreviewActions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    paddingTop: 2,
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
  previewSecondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  previewSecondaryButtonDisabled: {
    flex: 1,
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.58,
  },
  previewSecondaryButtonText: {
    color: palette.ink,
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
  previewStatusText: {
    color: palette.pencil,
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
    backgroundColor: palette.paper,
    paddingHorizontal: 18,
    paddingTop: 70,
    paddingBottom: 18,
    gap: 18,
    overflow: "hidden",
  },
  momentTopBar: {
    zIndex: 2,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  momentContentScroll: {
    flex: 1,
    width: "100%",
  },
  momentContent: {
    gap: 30,
    paddingTop: 12,
    paddingBottom: 8,
  },
  momentIconButton: {
    width: 44,
    height: 44,
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
    alignItems: "center",
    justifyContent: "center",
  },
  momentCloseText: {
    color: palette.ink,
    fontSize: 30,
    lineHeight: 32,
    fontWeight: "800",
  },
  momentDots: {
    color: palette.ink,
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "900",
  },
  momentScrap: {
    width: "100%",
    backgroundColor: palette.photoPaper,
    borderRadius: 4,
    padding: 8,
    paddingBottom: 26,
    shadowColor: palette.shadow,
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
    marginBottom: -6,
    transform: [{ rotate: "-1deg" }],
  },
  momentDetailDoodle: {
    right: 12,
    bottom: 4,
    opacity: 0.32,
    transform: [{ rotate: "12deg" }],
  },
  momentPolaroidTimestamp: {
    alignSelf: "flex-start",
    color: palette.ink,
    fontFamily: Platform.select({
      ios: "Noteworthy",
      android: "casual",
      default: "cursive",
    }),
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "500",
    letterSpacing: 1.15,
    marginTop: 16,
    marginLeft: 20,
    transform: [{ rotate: "-2deg" }],
  },
  photoViewerScreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: palette.paper,
  },
  photoViewerSafeArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingTop: 88,
    paddingBottom: 34,
  },
  photoViewerGlowTop: {
    position: "absolute",
    top: -110,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(237, 227, 255, 0.72)",
  },
  photoViewerGlowBottom: {
    position: "absolute",
    right: -110,
    bottom: -130,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(241, 232, 255, 0.66)",
  },
  photoViewerPaperFleckOne: {
    position: "absolute",
    top: 92,
    right: 48,
    width: 74,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255, 254, 249, 0.58)",
    transform: [{ rotate: "-12deg" }],
  },
  photoViewerPaperFleckTwo: {
    position: "absolute",
    left: 28,
    bottom: 104,
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "rgba(237, 227, 255, 0.46)",
  },
  photoViewerCloseButton: {
    position: "absolute",
    top: 58,
    right: 18,
    zIndex: 4,
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  photoViewerCloseText: {
    color: palette.ink,
    fontSize: 30,
    lineHeight: 32,
    fontWeight: "800",
  },
  photoViewerStage: {
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  photoViewerScroll: {
    borderRadius: 6,
  },
  photoViewerScrollContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  photoViewerImage: {
    resizeMode: "contain",
  },
  momentJournalEntry: {
    width: "88%",
    alignSelf: "flex-start",
    marginTop: 0,
    marginLeft: 16,
    marginRight: 4,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 2,
    transform: [{ rotate: "0.3deg" }],
  },
  momentJournalText: {
    color: palette.ink,
    fontFamily: Platform.select({
      ios: "Noteworthy",
      android: "serif",
      default: "serif",
    }),
    fontSize: 18,
    lineHeight: 29,
    fontWeight: "500",
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
  questHeroScrap: {
    position: "relative",
    paddingTop: 4,
    paddingBottom: 2,
    gap: 12,
  },
  heroSparkDoodle: {
    right: 14,
    bottom: 8,
    opacity: 0.42,
    transform: [{ rotate: "-14deg" }],
  },
  questHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 4,
  },
  questEmojiButton: {
    width: 72,
    height: 86,
    borderRadius: 8,
    backgroundColor: palette.photoPaper,
    borderWidth: 6,
    borderColor: palette.photoPaper,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.42,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    transform: [{ rotate: "-3deg" }],
  },
  questEmojiTape: {
    position: "absolute",
    top: -9,
    width: 48,
    height: 15,
    backgroundColor: "rgba(233, 217, 183, 0.76)",
    borderRadius: 2,
    zIndex: 2,
    transform: [{ rotate: "3deg" }],
  },
  questEmoji: {
    fontSize: 38,
  },
  questTitleWrap: {
    flex: 1,
    gap: 6,
  },
  questTitle: {
    color: palette.ink,
    fontSize: 38,
    fontWeight: "900",
    lineHeight: 40,
  },
  momentCount: {
    color: palette.pencil,
    fontSize: 15,
    fontWeight: "800",
  },
  questIdentityNote: {
    color: palette.pencil,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    fontWeight: "600",
    paddingLeft: 4,
  },
  logStepCard: {
    alignSelf: "stretch",
    minHeight: 104,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: palette.accent,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.58,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
    elevation: 5,
    overflow: "hidden",
  },
  logStepPaperGrain: {
    position: "absolute",
    left: -28,
    right: -28,
    top: -34,
    height: 82,
    borderRadius: 41,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    transform: [{ rotate: "-3deg" }],
  },
  logStepTape: {
    position: "absolute",
    right: 56,
    top: -4,
    width: 58,
    height: 14,
    borderRadius: 2,
    backgroundColor: "rgba(233, 217, 183, 0.28)",
    transform: [{ rotate: "2deg" }],
  },
  logStepIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraGlyph: {
    width: 31,
    height: 24,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraGlyphTop: {
    position: "absolute",
    top: -8,
    left: 6,
    width: 13,
    height: 7,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
  },
  cameraGlyphLens: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.92)",
  },
  cameraGlyphFlash: {
    position: "absolute",
    right: 4,
    top: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
  },
  logStepCopy: {
    flex: 1,
    gap: 6,
  },
  logStepTitle: {
    color: "#fff",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  logStepText: {
    color: "rgba(255, 255, 255, 0.84)",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
  logStepArrow: {
    color: "#fff",
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "500",
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
    position: "relative",
    backgroundColor: "rgba(255, 254, 249, 0.86)",
    borderRadius: 8,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.1)",
    shadowColor: palette.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  bridgeRow: {
    flexDirection: "row",
    gap: 16,
  },
  bridgePanel: {
    flex: 1,
    gap: 10,
  },
  bridgeLabel: {
    fontWeight: "900",
    color: palette.ink,
    fontSize: 14,
  },
  bridgeImage: {
    width: "100%",
    height: "100%",
    borderRadius: 3,
    backgroundColor: palette.panel,
  },
  bridgeImageWrap: {
    width: "100%",
    aspectRatio: 0.92,
    backgroundColor: palette.photoPaper,
    borderWidth: 8,
    borderBottomWidth: 22,
    borderColor: palette.photoPaper,
    borderRadius: 4,
    shadowColor: palette.shadow,
    shadowOpacity: 0.38,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  bridgePlaceholder: {
    aspectRatio: 0.85,
    borderRadius: 8,
    backgroundColor: "rgba(237, 227, 255, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(124, 58, 237, 0.28)",
  },
  placeholderText: {
    textAlign: "center",
    color: palette.muted,
    lineHeight: 20,
  },
  scrapbookArea: {
    position: "relative",
    gap: 14,
    backgroundColor: "rgba(255, 254, 249, 0.88)",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.09)",
    shadowColor: palette.shadow,
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  momentSections: {
    gap: 22,
  },
  momentSection: {
    gap: 12,
  },
  momentSectionTitle: {
    color: palette.pencil,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    opacity: 0.7,
    textTransform: "uppercase",
  },
  momentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 16,
  },
  momentTile: {
    overflow: "visible",
    borderRadius: 4,
    backgroundColor: palette.photoPaper,
    shadowColor: palette.shadow,
    shadowOpacity: 0.4,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  momentTileButton: {
    flex: 1,
    borderRadius: 4,
    padding: 6,
    paddingBottom: 23,
  },
  momentTileGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(124, 58, 237, 0.18)",
    borderWidth: 2,
    borderColor: "rgba(124, 58, 237, 0.44)",
    borderRadius: 4,
  },
  momentTileSquare: {
    aspectRatio: 0.94,
  },
  momentTileTall: {
    aspectRatio: 0.84,
  },
  momentTileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 3,
    resizeMode: "cover",
    backgroundColor: palette.panel,
  },
  photoTape: {
    position: "absolute",
    top: -7,
    alignSelf: "center",
    width: 54,
    height: 16,
    backgroundColor: "rgba(233, 217, 183, 0.76)",
    borderRadius: 2,
    zIndex: 2,
    transform: [{ rotate: "-2deg" }],
  },
  dateTag: {
    position: "absolute",
    left: 8,
    bottom: 6,
    backgroundColor: palette.photoPaper,
    color: palette.ink,
    borderRadius: 2,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "900",
    shadowColor: palette.shadow,
    shadowOpacity: 0.22,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  emptyScrapbookState: {
    minHeight: 190,
    borderRadius: 8,
    backgroundColor: "rgba(241, 232, 255, 0.52)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(124, 58, 237, 0.26)",
    padding: 16,
    gap: 10,
    alignItems: "flex-start",
  },
  emptyStateStar: {
    right: 18,
    top: 16,
    opacity: 0.62,
    transform: [{ rotate: "18deg" }],
  },
  addTodayTile: {
    aspectRatio: 0.94,
    alignSelf: "center",
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(124, 58, 237, 0.24)",
    backgroundColor: "rgba(255, 254, 249, 0.74)",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 4,
  },
  addTodayTape: {
    position: "absolute",
    top: -8,
    width: 58,
    height: 16,
    backgroundColor: "rgba(217, 188, 255, 0.72)",
    borderRadius: 2,
    transform: [{ rotate: "3deg" }],
  },
  addTodayIcon: {
    color: palette.muted,
    fontSize: 30,
    fontWeight: "900",
    opacity: 0.78,
  },
  addTodayText: {
    maxWidth: 105,
    color: palette.muted,
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center",
    fontWeight: "800",
  },
  chainNote: {
    alignSelf: "center",
    color: palette.ink,
    fontSize: 15,
    lineHeight: 21,
    fontStyle: "italic",
    fontWeight: "600",
    transform: [{ rotate: "-2deg" }],
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
    left: 12,
    right: 12,
    bottom: 8,
    flexDirection: "row",
    backgroundColor: "rgba(255, 254, 249, 0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(124, 58, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.12)",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 6,
    shadowColor: palette.shadowStrong,
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  navItem: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: "center",
    gap: 3,
  },
  navItemActive: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: "center",
    gap: 3,
    backgroundColor: palette.accentSoft,
  },
  navIconSlot: {
    width: FOOTER_ICON_SIZE,
    height: FOOTER_ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  navText: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  navTextActive: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: "900",
  },
});
