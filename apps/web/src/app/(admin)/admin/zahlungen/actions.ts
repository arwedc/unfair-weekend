'use server';

import { revalidatePath } from 'next/cache';
import { PAYMENT_RULES, paymentSettingsSchema, parseRpcError, percentToBps } from '@repo/shared';
import { requirePaymentAdmin } from '@/lib/zahlungen/auth';
import { getT } from '@/lib/i18n/locale';

export interface PaymentSettingsActionState {
  error?: string;
  saved?: boolean;
  values?: {
    payments_enabled: boolean;
    commission_percent: string;
    confirm_enable: boolean;
  };
}

export async function savePaymentSettingsAction(
  _previous: PaymentSettingsActionState,
  formData: FormData,
): Promise<PaymentSettingsActionState> {
  const { locale, t } = await getT();
  const a = t.admin;
  const supabase = await requirePaymentAdmin();
  const paymentsEnabled = formData.get('payments_enabled') === 'on';
  const confirmEnable = formData.get('confirm_enable') === 'on';
  const commissionPercent = String(formData.get('commission_percent') ?? '').trim();
  const commissionBps = percentToBps(commissionPercent);
  const values = {
    payments_enabled: paymentsEnabled,
    commission_percent: commissionPercent,
    confirm_enable: confirmEnable,
  };

  if (commissionBps === null) {
    return {
      values,
      error: a.invalidCommission(PAYMENT_RULES.maxCommissionBps / 100),
    };
  }
  const parsed = paymentSettingsSchema.safeParse({
    payments_enabled: paymentsEnabled,
    commission_bps: commissionBps,
  });
  if (!parsed.success) return { values, error: a.invalidInput };

  if (paymentsEnabled && !confirmEnable) {
    return {
      values,
      error: a.confirmRequired,
    };
  }

  const { data, error } = await supabase.rpc('update_payment_settings', {
    p_payments_enabled: parsed.data.payments_enabled,
    p_commission_bps: parsed.data.commission_bps,
  });
  if (error || !data?.[0]) {
    return { values, error: parseRpcError(error, locale)?.message ?? a.saveFailed };
  }

  revalidatePath('/admin/zahlungen');
  return { saved: true, values };
}
