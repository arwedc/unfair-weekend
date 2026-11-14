import { useRouter } from 'expo-router';
import { LogOut, Pencil, TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button, EmptyState, ListRow, Screen, Skeleton, Text } from '@/components/ui';
import { blockedNotice } from '@/features/auth/account';
import { signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/auth-context';
import { errorMessage } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, radius, space } from '@/theme';

import { GuestCard, InterestCircles, ProfileHero, StatsSection } from './ProfileParts';
import { InviteCard, ProfileMenu } from './ProfileMenu';

/**
 * Tab „Profil“: oben was Spaß macht (Profilbild, Bilanz, Stufe), dann Interessen,
 * Freunde einladen, ganz unten die Ordner: Mitgliedschaft,
 * Hilfe & Support, Geschenkkarte, Einstellungen und Rechtliches.
 */
export function ProfileScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { ready, userId, email, memberSince, account, accountLoading } = auth;
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
        <ProfileMenu signedIn={false} />
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
      <InviteCard />
      <ProfileMenu signedIn />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
