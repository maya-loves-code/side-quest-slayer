import * as FileSystem from "expo-file-system/legacy";

const QUEST_PHOTO_DIR = `${FileSystem.documentDirectory}quest-proof`;
const QUEST_PHOTO_REFERENCE_PREFIX = "quest-proof/";
const QUEST_PHOTO_PATH_MARKER = "/Documents/quest-proof/";
const SUPPORTED_PHOTO_EXTENSIONS = new Set(["jpg", "jpeg", "png", "heic", "webp"]);

export function createStoredPhotoReference(uri: string) {
  const markerIndex = uri.indexOf(QUEST_PHOTO_PATH_MARKER);

  if (markerIndex >= 0) {
    return `${QUEST_PHOTO_REFERENCE_PREFIX}${uri.slice(markerIndex + QUEST_PHOTO_PATH_MARKER.length)}`;
  }

  return uri;
}

export function resolveStoredPhotoUri(uri: string) {
  if (uri.startsWith(QUEST_PHOTO_REFERENCE_PREFIX)) {
    return `${FileSystem.documentDirectory}${uri}`;
  }

  const markerIndex = uri.indexOf(QUEST_PHOTO_PATH_MARKER);

  if (markerIndex >= 0) {
    return `${QUEST_PHOTO_DIR}/${uri.slice(markerIndex + QUEST_PHOTO_PATH_MARKER.length)}`;
  }

  return uri;
}

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

export async function saveDemoAssetPhoto(sourceUri: string, filename: string) {
  await ensurePhotoDirectory();

  const safeFilename = getSafeDemoAssetFilename(filename);
  const destination = `${QUEST_PHOTO_DIR}/${safeFilename}`;
  await FileSystem.deleteAsync(destination, { idempotent: true });

  if (/^https?:\/\//i.test(sourceUri)) {
    await FileSystem.downloadAsync(sourceUri, destination);
  } else {
    await FileSystem.copyAsync({
      from: sourceUri,
      to: destination,
    });
  }

  return destination;
}

function getSafeDemoAssetFilename(filename: string) {
  const basename = filename.trim().split(/[\\/]/).pop() ?? "";
  const safeFilename = basename.replace(/[^a-z0-9._-]/gi, "-").replace(/^\.+/, "");

  if (!safeFilename || safeFilename === "." || safeFilename === "..") {
    throw new Error("Invalid demo asset filename.");
  }

  return safeFilename;
}

export async function deleteStoredPhoto(uri: string) {
  try {
    const resolvedUri = resolveStoredPhotoUri(uri);
    const info = await FileSystem.getInfoAsync(resolvedUri);

    if (info.exists) {
      await FileSystem.deleteAsync(resolvedUri, { idempotent: true });
    }

    return true;
  } catch (error) {
    console.warn("Could not delete stored photo", error);
    return false;
  }
}

export async function deleteAllStoredPhotos() {
  try {
    const info = await FileSystem.getInfoAsync(QUEST_PHOTO_DIR);

    if (info.exists) {
      await FileSystem.deleteAsync(QUEST_PHOTO_DIR, { idempotent: true });
    }

    return true;
  } catch (error) {
    console.warn("Could not delete stored photos", error);
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
