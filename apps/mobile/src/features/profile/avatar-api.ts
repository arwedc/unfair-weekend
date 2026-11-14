/**
 * Profilbild: auswählen, verkleinern, hochladen, setzen und entfernen.
 * Bucket `avatars` ist privat (docs/BACKEND.md, Storage). Angezeigt wird über eine signierte URL.
 */
import { STORAGE_BUCKETS } from '@repo/shared';
import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { ApiError, toApiError } from '@/lib/api-error';
import { getLocale } from '@/lib/i18n/locale-store';
import { getMessages } from '@/lib/i18n/messages';
import { supabase } from '@/lib/supabase';

import { avatarStoragePath } from './profile-logic';

/** Kantenlänge des gespeicherten Bilds. Reicht für scharfe Avatare und bleibt klein (~50 KB). */
const AVATAR_SIZE = 512;
/** So lange gilt eine signierte URL. Die Abfrage erneuert sie vorher. */
export const AVATAR_URL_TTL_SECONDS = 60 * 60;

export type AvatarSource = 'library' | 'camera';

/** Der Nutzer hat die Kamera nicht erlaubt. Das Profil bietet dann die Handy-Einstellungen an. */
export const CAMERA_DENIED = 'KAMERA_NICHT_ERLAUBT';

const bucket = () => supabase.storage.from(STORAGE_BUCKETS.avatars);

/**
 * Öffnet Mediathek oder Kamera mit quadratischem Zuschnitt.
 * Liefert die lokale Datei oder null, wenn abgebrochen wurde.
 */
export async function pickAvatar(source: AvatarSource): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new ApiError(CAMERA_DENIED, getMessages(getLocale()).profile.avatar.cameraDenied);
    }
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

/** Verkleinert auf AVATAR_SIZE und speichert als JPEG. */
async function shrink(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: AVATAR_SIZE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return saved.uri;
}

/** Löscht Dateien im eigenen Ordner. Fehler sind egal: Es bleibt höchstens eine Datei liegen. */
async function removeFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await bucket()
    .remove(paths)
    .catch(() => undefined);
}

/**
 * Lädt ein neues Profilbild hoch und setzt es. Das alte wird danach gelöscht.
 * Gibt den neuen Pfad zurück.
 */
export async function uploadAvatar(
  userId: string,
  localUri: string,
  previousPath: string | null,
): Promise<string> {
  const file = await shrink(localUri);
  const body = await fetch(file).then((response) => response.arrayBuffer());
  const path = avatarStoragePath(userId, Crypto.randomUUID());

  const upload = await bucket().upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (upload.error) throw toApiError(upload.error);

  const { error } = await supabase.rpc('update_my_avatar', { p_path: path });
  if (error) {
    await removeFiles([path]);
    throw toApiError(error);
  }
  if (previousPath && previousPath !== path) await removeFiles([previousPath]);
  return path;
}

/** Entfernt das Profilbild (erst in der DB, dann die Datei). */
export async function removeAvatar(previousPath: string | null): Promise<void> {
  // Leerer Pfad entfernt das Bild (wie null, passt aber zum generierten Typ).
  const { error } = await supabase.rpc('update_my_avatar', { p_path: '' });
  if (error) throw toApiError(error);
  if (previousPath) await removeFiles([previousPath]);
}

/** Vor dem Löschen des Kontos: alle eigenen Bilder weg (die DB kann Storage nicht selbst leeren). */
export async function removeAllAvatars(userId: string): Promise<void> {
  const { data } = await bucket().list(userId, { limit: 100 });
  await removeFiles((data ?? []).map((file) => `${userId}/${file.name}`));
}

/** Signierte URL zum Anzeigen des eigenen Profilbilds. */
export async function avatarUrl(path: string): Promise<string> {
  const { data, error } = await bucket().createSignedUrl(path, AVATAR_URL_TTL_SECONDS);
  if (error) throw toApiError(error);
  return data.signedUrl;
}
