import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function scheduleDailyQuestReminder() {
  const permissions = await Notifications.requestPermissionsAsync();

  if (!permissions.granted && permissions.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return false;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Side Quest Slayer",
      body: "Did you work on your quest today?",
    },
    trigger: {
      hour: 20,
      minute: 0,
      repeats: true,
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    },
  });

  return true;
}
