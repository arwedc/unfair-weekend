/** Geschenkkarte senden: Platzhalter, bis es Geschenkkarten gibt. */
import { Gift } from 'lucide-react-native';

import { EmptyState } from '@/components/ui';
import { useT } from '@/lib/i18n/context';

export function GiftCardScreen() {
  const { t } = useT();
  const m = t.profile.giftCard;
  return <EmptyState icon={Gift} title={m.soonTitle} message={m.soonText} />;
}
