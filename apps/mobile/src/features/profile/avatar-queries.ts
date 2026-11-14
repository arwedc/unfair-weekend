import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth, userKeys } from '@/features/auth/auth-context';

import {
  AVATAR_URL_TTL_SECONDS,
  avatarUrl,
  pickAvatar,
  removeAvatar,
  uploadAvatar,
  type AvatarSource,
} from './avatar-api';

/** Signierte URL des eigenen Profilbilds. Wird erneuert, bevor sie abläuft. */
export function useAvatarUrl(path: string | null) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: [...userKeys.all, userId ?? 'anon', 'avatar', path],
    queryFn: () => avatarUrl(path ?? ''),
    enabled: userId !== null && path !== null,
    staleTime: (AVATAR_URL_TTL_SECONDS - 5 * 60) * 1000,
    refetchInterval: (AVATAR_URL_TTL_SECONDS - 5 * 60) * 1000,
  });
}

/**
 * Bild auswählen (Mediathek oder Kamera), hochladen und setzen.
 * Ergibt `false`, wenn der Nutzer abgebrochen hat.
 */
export function useChangeAvatar() {
  const { userId, account } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (source: AvatarSource) => {
      if (!userId) return false;
      const uri = await pickAvatar(source);
      if (!uri) return false;
      await uploadAvatar(userId, uri, account?.avatarPath ?? null);
      return true;
    },
    onSuccess: (changed) => {
      if (changed && userId) {
        void queryClient.invalidateQueries({ queryKey: userKeys.account(userId) });
      }
    },
  });
}

export function useRemoveAvatar() {
  const { userId, account } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => removeAvatar(account?.avatarPath ?? null),
    onSuccess: () => {
      if (userId) void queryClient.invalidateQueries({ queryKey: userKeys.account(userId) });
    },
  });
}
