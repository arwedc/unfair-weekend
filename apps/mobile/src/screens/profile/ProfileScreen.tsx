import { LOCALE_NAMES, LOCALES } from '@repo/shared/i18n';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  Bell,
  CircleHelp,
  FileText,
  Languages,
  LogOut,
  Pencil,
  Share2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Share, StyleSheet, Switch, View } from 'react-native';

import {
  Button,
  EmptyState,
  ListRow,
  Screen,
  SectionHeader,
  SegmentedTabs,
  Sheet,
  Skeleton,
  Text,
  type SheetRef,
} from '@/components/ui';
import { blockedNotice } from '@/features/auth/account';
import { deleteAccount, signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/auth-context';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { usePushStatus, useSetPushEnabled } from '@/features/push/use-push';
import { errorMessage } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, radius, space } from '@/theme';

import {
  FavoritePlacesRow,
  GuestCard,
  InterestCircles,
  ProfileHero,
  StatsSection,
} from './ProfileParts';

/** Hilfe & Infos: Rundgang, Freunde einladen, Datenschutz, Impressum. */
function HelpRows() {
  const router = useRouter();
  const { t } = useT();
  const p = t.common.profile;
  return (
    <View>
      <OnboardingHelpRow />
      <ListRow
        icon={Share2}
        title={p.invite}
        detail={p.inviteHint}
        onPress={() => void Share.share({ message: p.inviteMessage })}
      />
      <ListRow
        icon={ShieldCheck}
        title={t.common.profile.privacy}
        onPress={() =>
          router.push({ pathname: '/rechtliches/[seite]', params: { seite: 'datenschutz' } })
        }
      />
      <ListRow
        icon={FileText}
        title={t.common.profile.imprint}
        onPress={() =>
          router.push({ pathname: '/rechtliches/[seite]', params: { seite: 'impressum' } })
        }
      />
    </View>
  );
}

function OnboardingHelpRow() {
  const { replay } = useOnboarding();
  const { t } = useT();
  return (
    <ListRow
      icon={CircleHelp}
      title={t.common.profile.tour}
      detail={t.common.profile.tourHint}
      onPress={replay}
    />
  );
}

/** Schalter für Push-Benachrichtigungen. Erklärt, warum es (noch) nicht geht, statt still nichts zu tun. */
function PushSettings() {
  const { data: state, refetch } = usePushStatus();
  const toggle = useSetPushEnabled();
  const { t } = useT();

  useEffect(() => {
    // Nach der Rückkehr aus den Handy-Einstellungen den Stand neu lesen.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  return (
    <View>
      {!state ? (
        <Skeleton height={56} />
      ) : (
        <ListRow
          icon={Bell}
          title={t.common.profile.push}
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
              <Switch
                value={state.enabled}
                disabled={toggle.isPending}
                onValueChange={(value) => toggle.mutate(value)}
                trackColor={{ true: colors.accent.solid, false: colors.border.strong }}
                accessibilityLabel={t.common.profile.push}
              />
            ) : undefined
          }
        />
      )}
    </View>
  );
}

/** Sprache der Oberfläche. Inhalte (Angebote, Bewertungen) bleiben, wie sie sind. */
function LanguageSettings() {
  const { t, locale, setLocale } = useT();
  return (
    <View style={styles.languageBlock}>
      <View style={styles.language}>
        <Languages size={20} color={colors.text.secondary} />
        <View style={styles.languageTabs}>
          <SegmentedTabs
            tabs={LOCALES.map((key) => ({ key, label: LOCALE_NAMES[key] }))}
            value={locale}
            onChange={setLocale}
          />
        </View>
      </View>
      <Text variant="footnote" color="secondary">
        {t.common.profile.languageHint}
      </Text>
    </View>
  );
}

function Footer() {
  const { t } = useT();
  const version = Constants.expoConfig?.version;
  return version ? (
    <Text variant="caption" color="tertiary" align="center">
      {t.common.profile.version(version)}
    </Text>
  ) : null;
}

/**
 * Tab „Profil“: oben was Spaß macht (Avatar, Bilanz, Stufe), dann Persönliches
 * (Interessen, Lieblingsorte), darunter Einstellungen, Hilfe und ganz unten das Konto.
 */
export function ProfileScreen() {
  const router = useRouter();
  const deleteSheet = useRef<SheetRef>(null);
  const auth = useAuth();
  const { ready, userId, email, memberSince, account, accountLoading } = auth;
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { t, locale } = useT();
  const p = t.common.profile;

  if (!ready || (userId !== null && accountLoading)) {
    return (
      <Screen>
        <View style={styles.loadingHero}>
          <Skeleton width={76} height={76} radius={38} />
          <View style={styles.loadingText}>
            <Skeleton width="70%" height={28} />
            <Skeleton width="45%" height={16} />
          </View>
        </View>
        <Skeleton height={112} radius={radius.card} />
      </Screen>
    );
  }

  if (userId === null) {
    return (
      <Screen>
        <Text variant="title1" accessibilityRole="header">
          {p.title}
        </Text>
        <GuestCard />
        <View style={styles.section}>
          <SectionHeader title={p.settings} />
          <LanguageSettings />
        </View>
        <View style={styles.section}>
          <SectionHeader title={p.help} />
          <HelpRows />
        </View>
        <Footer />
      </Screen>
    );
  }

  if (!account) {
    return (
      <Screen>
        <Text variant="title1" accessibilityRole="header">
          {p.title}
        </Text>
        <EmptyState
          tone="error"
          icon={TriangleAlert}
          title={t.common.accountNotLoaded}
          message={errorMessage(auth.accountError)}
          actionLabel={t.common.retry}
          onAction={() => void auth.refetchAccount()}
        />
        <ListRow icon={LogOut} title={t.common.signOut} onPress={() => void signOut()} />
      </Screen>
    );
  }

  const blocked = blockedNotice(account, locale);

  const confirmDelete = async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      deleteSheet.current?.dismiss();
    } catch (caught) {
      setDeleteError(errorMessage(caught));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen>
      <ProfileHero account={account} email={email} memberSince={memberSince} />

      {blocked ? (
        <View style={styles.notice} accessibilityRole="alert">
          <TriangleAlert size={20} color={colors.status.warning.onSubtle} />
          <Text variant="footnote" style={styles.noticeText}>
            {blocked}
          </Text>
        </View>
      ) : null}

      {!account.profileComplete ? (
        <Button
          label={p.addName}
          icon={Pencil}
          variant="secondary"
          fullWidth
          onPress={() => router.push('/name')}
        />
      ) : null}

      <StatsSection />
      <InterestCircles />
      <FavoritePlacesRow />

      <View style={styles.section}>
        <SectionHeader title={p.settings} />
        <View style={styles.group}>
          <PushSettings />
          <LanguageSettings />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title={p.help} />
        <HelpRows />
      </View>

      <View style={styles.section}>
        <SectionHeader title={p.account} />
        <View>
          <ListRow icon={LogOut} title={t.common.signOut} onPress={() => void signOut()} />
          <ListRow
            icon={Trash2}
            title={p.deleteAccount}
            destructive
            onPress={() => {
              setDeleteError(null);
              deleteSheet.current?.present();
            }}
          />
        </View>
      </View>

      <Footer />

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[3] },
  group: { gap: space[4] },
  loadingHero: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  loadingText: { flex: 1, gap: space[2] },
  notice: {
    flexDirection: 'row',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.status.warning.subtle,
  },
  noticeText: { flex: 1, color: colors.status.warning.onSubtle },
  languageBlock: { gap: space[2] },
  language: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  languageTabs: { flex: 1 },
});
