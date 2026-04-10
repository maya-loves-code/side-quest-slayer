import * as FileSystem from "expo-file-system/legacy";

const QUEST_PHOTO_DIR = `${FileSystem.documentDirectory}quest-proof`;

export async function ensurePhotoDirectory() {
  const info = await FileSystem.getInfoAsync(QUEST_PHOTO_DIR);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(QUEST_PHOTO_DIR, { intermediates: true });
  }
}

export async function saveCapturedPhoto(tempUri: string) {
  await ensurePhotoDirectory();

  const filename = `proof-${Date.now()}.jpg`;
  const destination = `${QUEST_PHOTO_DIR}/${filename}`;

  await FileSystem.copyAsync({
    from: tempUri,
    to: destination,
  });

  return destination;
}

export async function deleteStoredPhoto(uri: string) {
  try {
    const info = await FileSystem.getInfoAsync(uri);

    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (error) {
    console.warn("Could not delete stored photo", error);
  }
}
