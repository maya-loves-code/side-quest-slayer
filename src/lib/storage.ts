import * as FileSystem from "expo-file-system/legacy";

const QUEST_PHOTO_DIR = `${FileSystem.documentDirectory}quest-proof`;
const SUPPORTED_PHOTO_EXTENSIONS = new Set(["jpg", "jpeg", "png", "heic", "webp"]);

export async function ensurePhotoDirectory() {
  const info = await FileSystem.getInfoAsync(QUEST_PHOTO_DIR);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(QUEST_PHOTO_DIR, { intermediates: true });
  }
}

export async function saveCapturedPhoto(tempUri: string) {
  await ensurePhotoDirectory();
  await assertReadablePhoto(tempUri);

  const filename = `proof-${createPhotoFilenameSuffix()}.jpg`;
  const destination = `${QUEST_PHOTO_DIR}/${filename}`;

  await FileSystem.copyAsync({
    from: tempUri,
    to: destination,
  });

  return destination;
}

export async function saveImportedPhoto(sourceUri: string) {
  await ensurePhotoDirectory();
  await assertReadablePhoto(sourceUri);

  const destination = `${QUEST_PHOTO_DIR}/import-${createPhotoFilenameSuffix()}.${getSafePhotoExtension(sourceUri)}`;

  await FileSystem.copyAsync({
    from: sourceUri,
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

    return true;
  } catch (error) {
    console.warn("Could not delete stored photo", error);
    return false;
  }
}

async function assertReadablePhoto(uri: string) {
  const info = await FileSystem.getInfoAsync(uri);

  if (!info.exists) {
    throw new Error("Photo file does not exist.");
  }
}

function getSafePhotoExtension(uri: string) {
  const extension = uri.match(/\.([a-z0-9]+)(?:\?|#|$)/i)?.[1]?.toLowerCase();

  return extension && SUPPORTED_PHOTO_EXTENSIONS.has(extension) ? extension : "jpg";
}

function createPhotoFilenameSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
