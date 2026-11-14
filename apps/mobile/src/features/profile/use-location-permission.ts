import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, Linking } from 'react-native';

import { useLocale } from '@/lib/i18n/context';
import { locationPermissionState, requestLocationPermission } from '@/lib/location';

import { locationRowState } from './settings-logic';

const locationPermissionKey = ['location-permission'] as const;

/** Zeile „Standortzugriff“. Liest den Stand neu, wenn die App aus den Handy-Einstellungen zurückkommt. */
export function useLocationRow() {
  const locale = useLocale();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: locationPermissionKey,
    queryFn: locationPermissionState,
    staleTime: 0,
  });
  const { refetch } = query;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  const ask = useMutation({
    mutationFn: requestLocationPermission,
    onSuccess: (state) => queryClient.setQueryData(locationPermissionKey, state),
  });

  const state = query.data ? locationRowState(query.data, locale) : null;
  const press = () => {
    if (!state) return;
    if (state.action === 'ask') ask.mutate();
    else void Linking.openSettings();
  };

  return { state, press, pending: ask.isPending };
}
