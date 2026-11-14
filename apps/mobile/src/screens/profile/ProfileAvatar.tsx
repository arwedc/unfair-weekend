/** Profilbild im Profilkopf: Foto oder bunte Initialen, antippbar zum Ändern. */
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Camera, ImagePlus, Images, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';

import { Button, ListRow, PressableScale, Sheet, Text, type SheetRef } from '@/components/ui';
import type { Account } from '@/features/auth/account';
import { CAMERA_DENIED, type AvatarSource } from '@/features/profile/avatar-api';
import { useAvatarUrl, useChangeAvatar, useRemoveAvatar } from '@/features/profile/avatar-queries';
import { avatarTint, initials } from '@/features/profile/profile-logic';
import { ApiError, errorMessage } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, duration, fun, radii, space } from '@/theme';

const SIZE = 76;
const BADGE = 28;

/** Rundes Bild: Foto, solange es lädt die Initialen, bei Fehlern ebenfalls die Initialen. */
function AvatarImage({ account }: { account: Account }) {
  const url = useAvatarUrl(account.avatarPath);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const tone = fun[avatarTint(account.userId)];
  const showPhoto = url.data !== undefined && url.data !== failedUrl;

  return (
    <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
      <Text variant="title1" style={{ color: tone.ink }} maxFontSizeMultiplier={1.2}>
        {initials(account.firstName, account.lastName)}
      </Text>
      {showPhoto ? (
        <Image
          source={{ uri: url.data, cacheKey: account.avatarPath ?? undefined }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={duration.fast}
          onError={() => setFailedUrl(url.data ?? null)}
          accessible={false}
        />
      ) : null}
    </View>
  );
}

/**
 * Avatar mit Kamera-Abzeichen. Ein Tipp öffnet das Sheet „Profilbild“.
 * Mediathek bzw. Kamera öffnen sich erst, wenn das Sheet zu ist (iOS zeigt sonst nichts).
 */
export function ProfileAvatar({ account }: { account: Account }) {
  const { t } = useT();
  const m = t.profile.avatar;
  const sheet = useRef<SheetRef>(null);
  const nextSource = useRef<AvatarSource | null>(null);
  const change = useChangeAvatar();
  const remove = useRemoveAvatar();
  const busy = change.isPending || remove.isPending;
  const hasPhoto = account.avatarPath !== null;
  const error = change.error ?? remove.error;
  const cameraDenied = error instanceof ApiError && error.code === CAMERA_DENIED;

  const choose = (source: AvatarSource) => {
    nextSource.current = source;
    sheet.current?.dismiss();
  };

  const onDismiss = () => {
    const source = nextSource.current;
    nextSource.current = null;
    if (!source) return;
    change.mutate(source, {
      onSuccess: (changed) => {
        if (changed) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      // Fehler zeigt das Sheet, dort kann man es direkt nochmal versuchen.
      onError: () => sheet.current?.present(),
    });
  };

  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={hasPhoto ? m.change : m.add}
        accessibilityState={{ busy }}
        disabled={busy}
        onPress={() => {
          change.reset();
          remove.reset();
          sheet.current?.present();
        }}
        style={styles.pressable}
      >
        <AvatarImage account={account} />
        {busy ? (
          <View style={styles.busy} accessibilityLabel={m.saving}>
            <ActivityIndicator color={colors.text.inverse} />
          </View>
        ) : null}
        <View style={styles.badge}>
          {hasPhoto ? (
            <Camera size={14} color={colors.text.onAccent} strokeWidth={2.5} />
          ) : (
            <ImagePlus size={14} color={colors.text.onAccent} strokeWidth={2.5} />
          )}
        </View>
      </PressableScale>

      <Sheet ref={sheet} title={m.title} onDismiss={onDismiss}>
        <Text variant="footnote" color="secondary">
          {m.hint}
        </Text>
        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Text variant="callout" style={{ color: colors.status.error.text }}>
              {errorMessage(error)}
            </Text>
            {cameraDenied ? (
              <Button
                label={m.openSettings}
                variant="secondary"
                fullWidth
                onPress={() => void Linking.openSettings()}
              />
            ) : null}
          </View>
        ) : null}
        <View>
          <ListRow icon={Images} title={m.library} onPress={() => choose('library')} />
          <ListRow icon={Camera} title={m.camera} onPress={() => choose('camera')} />
          {hasPhoto ? (
            <ListRow
              icon={Trash2}
              title={m.remove}
              destructive
              onPress={() => {
                change.reset();
                sheet.current?.dismiss();
                remove.mutate(undefined, { onError: () => sheet.current?.present() });
              }}
            />
          ) : null}
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  pressable: { width: SIZE, height: SIZE },
  avatar: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.overlay,
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: BADGE,
    height: BADGE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.solid,
    borderWidth: 2,
    borderColor: colors.background.default,
  },
  error: { gap: space[3] },
});
