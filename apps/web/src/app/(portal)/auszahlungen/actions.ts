'use server';

import { redirect } from 'next/navigation';
import { UNKNOWN_ERROR_MESSAGE } from '@repo/shared';
import { requireAccount } from '@/lib/auth';
import { invokeConnect, paymentReturnUrls } from '@/lib/zahlungen/connect';

export interface ConnectActionState {
  error?: string;
}

export async function startOnboardingAction(
  _previous: ConnectActionState,
  _formData: FormData,
): Promise<ConnectActionState> {
  void _previous;
  void _formData;
  await requireAccount();
  const result = await invokeConnect({ action: 'onboarding', ...paymentReturnUrls() });
  if (result.error) return { error: result.error };
  if (!result.result?.url) return { error: UNKNOWN_ERROR_MESSAGE };
  redirect(result.result.url);
}

export async function openStripeDashboardAction(
  _previous: ConnectActionState,
  _formData: FormData,
): Promise<ConnectActionState> {
  void _previous;
  void _formData;
  await requireAccount();
  const result = await invokeConnect({ action: 'dashboard' });
  if (result.error) return { error: result.error };
  if (!result.result?.url) return { error: UNKNOWN_ERROR_MESSAGE };
  redirect(result.result.url);
}
