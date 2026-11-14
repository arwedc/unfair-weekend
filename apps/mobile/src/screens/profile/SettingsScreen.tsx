/**
 * Einstellungen (aus dem Profil): Hinweis zu den Handy-Einstellungen, Sprache,
 * Benachrichtigungen, Standortzugriff, Datenschutz, Version, Abmelden und Konto löschen.
 */
import { LOCALE_NAMES, LOCALES } from '@repo/shared/i18n';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Bell,
  Check,
  Info,
  Languages,
  LogOut,
  Navigation,
  ShieldCheck,
  Smartphone,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, StyleSheet, Switch, View } from 'react-native';

import {
  Button,
  ListGroup,
  ListRow,
  Page,
  Sheet,
  Skeleton,
  Text,
  type SheetRef,
} from '@/components/ui';
import { deleteAccount, signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/auth-context';
import { useLocationRow } from '@/features/profile/use-location-permission';
import { usePushStatus, useSetPushEnabled } from '@/features/push/use-push';
import { errorMessage } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, radius, space } from '@/theme';

function SettingSwitch({
  value,
  disabled,
  onChange,
  label,
}: {
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <Switch
      value={value}
      disabled={disabled}
      onValueChange={onChange}
      trackColor={{ true: colors.accent.solid, false: colors.border.strong }}
      accessibilityLabel={label}
    />
  );
}

/** Push an/aus. Erklärt, warum es (noch) nicht geht, statt still nichts zu tun. */
function PushRow() {
  const { data: state, refetch } = usePushStatus();
  const toggle = useSetPushEnabled();
  const { t } = useT();
  const title = t.profile.settings.notifications;

  useEffect(() => {
    // Nach der Rückkehr aus den Handy-Einstellungen den Stand neu lesen.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  if (!state) return <Skeleton height={56} />;
  return (
    <ListRow
      icon={Bell}
      title={title}
      detail={state.detail}
      onPress={
        state.action === 'settings'
          ? () => void Linking.openSettings()
          : state.action === 'toggle' && !toggle.isPending
            ? () => toggle.mutate(!state.enabled)
            : undefined
      }
      trailing={
        state.action === 'toggle' ? (
          <SettingSwitch
            value={state.enabled}
            disabled={toggle.isPending}
            onChange={(value) => toggle.mutate(value)}
            label={title}
          />
        ) : undefined
      }
    />
  );
}

/** Standortzugriff: Schalter zeigt den Stand, ein Tipp fragt oder öffnet die Handy-Einstellungen. */
function LocationRow() {
  const { state, press, pending } = useLocationRow();
  const { t } = useT();
  const title = t.profile.settings.location;
  if (!state) return <Skeleton height={56} />;
  return (
    <ListRow
      icon={Navigation}
      title={title}
      detail={state.detail}
      onPress={pending ? undefined : press}
      trailing={
        <SettingSwitch value={state.enabled} disabled={pending} onChange={press} label={title} />
      }
    />
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const { userId, account } = useAuth();
  const { t, locale, setLocale } = useT();
  const s = t.profile.settings;
  const p = t.common.profile;
  const languageSheet = useRef<SheetRef>(null);
  const deleteSheet = useRef<SheetRef>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const version = Constants.expoConfig?.version;
  const signedIn = userId !== null;
  // Standort- und Admin-Konten löschen sich nicht in der App (KONTO_NICHT_LOESCHBAR).
  const canDelete = account?.role === 'nutzer';

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/profil'));

  const confirmDelete = async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      deleteSheet.current?.dismiss();
      leave();
    } catch (caught) {
      setDeleteError(errorMessage(caught));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Page>
      <View style={styles.info}>
        <Info size={20} color={colors.text.secondary} />
        <Text variant="footnote" color="secondary" style={styles.infoText}>
          {s.deviceHint}
        </Text>
      </View>

      <ListGroup>
        <ListRow
          icon={Languages}
          title={s.language}
          detail={LOCALE_NAMES[locale]}
          onPress={() => languageSheet.current?.present()}
        />
        {signedIn ? <PushRow /> : null}
        <LocationRow />
        <ListRow
          icon={ShieldCheck}
          title={s.privacy}
          onPress={() =>
            router.push({ pathname: '/rechtliches/[seite]', params: { seite: 'datenschutz' } })
          }
        />
        {version ? <ListRow icon={Smartphone} title={s.version(version)} /> : null}
      </ListGroup>

      {signedIn ? (
        <View style={styles.account}>
          <Button
            label={t.common.signOut}
            icon={LogOut}
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => void signOut().then(leave)}
          />
          {canDelete ? (
            <Button
              label={s.deleteAccount}
              variant="ghost"
              fullWidth
              onPress={() => {
                setDeleteError(null);
                deleteSheet.current?.present();
              }}
            />
          ) : null}
        </View>
      ) : null}

      <Sheet ref={languageSheet} title={s.languageTitle}>
        <ListGroup>
          {LOCALES.map((key) => (
            <ListRow
              key={key}
              title={LOCALE_NAMES[key]}
              onPress={() => {
                void Haptics.selectionAsync();
                setLocale(key);
                languageSheet.current?.dismiss();
              }}
              trailing={
                key === locale ? <Check size={20} color={colors.accent.strong} /> : <View />
              }
            />
          ))}
        </ListGroup>
        <Text variant="footnote" color="secondary">
          {p.languageHint}
        </Text>
      </Sheet>

      <Sheet ref={deleteSheet} title={p.deleteTitle}>
        <Text variant="body" color="secondary">
          {p.deleteText}
        </Text>
        {deleteError ? (
          <Text
            variant="callout"
            accessibilityLiveRegion="polite"
            style={{ color: colors.status.error.text }}
          >
            {deleteError}
          </Text>
        ) : null}
        <Button
          label={p.deleteConfirm}
          variant="danger"
          size="lg"
          fullWidth
          loading={deleting}
          onPress={() => void confirmDelete()}
        />
        <Button
          label={t.common.cancel}
          variant="secondary"
          fullWidth
          disabled={deleting}
          onPress={() => deleteSheet.current?.dismiss()}
        />
      </Sheet>
    </Page>
  );
}

const styles = StyleSheet.create({
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: colors.background.subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
  },
  infoText: { flex: 1 },
  account: { gap: space[2] },
});
