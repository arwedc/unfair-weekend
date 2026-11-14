import { NativeTabs } from 'expo-router/native-tabs';

import { useT } from '@/lib/i18n/context';
import { colors, fonts } from '@/theme';

/**
 * Die vier Tabs der App als echte native Tab-Leiste (iOS: Liquid Glass, Android: Material 3).
 * Icons: SF Symbols auf iOS, Material Symbols auf Android.
 */
export default function TabsLayout() {
  const { t } = useT();
  return (
    <NativeTabs
      tintColor={colors.accent.strong}
      labelStyle={{ fontFamily: fonts.semibold }}
      // Die Leiste bleibt beim Scrollen immer voll sichtbar.
      minimizeBehavior="never"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t.common.tabs.discover}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'safari', selected: 'safari.fill' }} md="explore" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="karte">
        <NativeTabs.Trigger.Label>{t.common.tabs.map}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} md="map" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="codes">
        <NativeTabs.Trigger.Label>{t.common.tabs.codes}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'ticket', selected: 'ticket.fill' }}
          md="confirmation_number"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profil">
        <NativeTabs.Trigger.Label>{t.common.tabs.profile}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md="account_circle"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
