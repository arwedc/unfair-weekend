/** Ordner „Rechtliches“: Nutzungsbedingungen, Datenschutz und Impressum. */
import { useRouter } from 'expo-router';
import { Building2, FileText, ShieldCheck } from 'lucide-react-native';

import { ListGroup, ListRow, Page } from '@/components/ui';
import { useT } from '@/lib/i18n/context';

import type { LegalPage } from './LegalScreen';

export function LegalMenuScreen() {
  const router = useRouter();
  const { t } = useT();
  const p = t.common.profile;
  const open = (seite: LegalPage) =>
    router.push({ pathname: '/rechtliches/[seite]', params: { seite } });

  return (
    <Page>
      <ListGroup>
        <ListRow icon={FileText} title={p.terms} onPress={() => open('nutzungsbedingungen')} />
        <ListRow icon={ShieldCheck} title={p.privacy} onPress={() => open('datenschutz')} />
        <ListRow icon={Building2} title={p.imprint} onPress={() => open('impressum')} />
      </ListGroup>
    </Page>
  );
}
