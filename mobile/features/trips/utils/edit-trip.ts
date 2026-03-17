import { ApiError } from '@/lib/api/client';
import { type UpdateTripRequest } from '@/features/trips/types/trip-edit';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type EditTripBasicFormValues = {
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
};

export type EditTripPreferenceFormValues = {
  budget: string;
  transportType: string;
};

export function getTripEditErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }
  if (error.status === 401) {
    return '認証期限が切れています。再ログイン後にお試しください。';
  }
  if (error.status === 403) {
    return 'このプランを編集する権限がありません。';
  }
  if (error.status === 404) {
    return '対象プランが見つかりませんでした。';
  }
  return `${fallback} (${error.status})`;
}

export function validateAndBuildTripBasicPayload(
  values: EditTripBasicFormValues
): { ok: true; payload: UpdateTripRequest } | { ok: false; message: string } {
  const origin = values.origin.trim();
  const destination = values.destination.trim();
  const startDate = values.startDate.trim();
  const endDate = values.endDate.trim();

  if (!origin || !destination || !startDate || !endDate) {
    return { ok: false, message: '出発地・目的地・出発日・終了日は必須です。' };
  }
  if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) {
    return { ok: false, message: '日付は YYYY-MM-DD 形式で入力してください。' };
  }

  return {
    ok: true,
    payload: {
      origin,
      destination,
      start_date: startDate,
      end_date: endDate,
    },
  };
}

export function parsePreferenceBudget(
  values: EditTripPreferenceFormValues
): { ok: true; budget?: number; transportType?: string } | { ok: false; message: string } {
  const budgetText = values.budget.trim();
  const transportType = values.transportType.trim() || undefined;

  if (!budgetText) {
    return { ok: true, budget: undefined, transportType };
  }

  const parsed = Number(budgetText);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { ok: false, message: '予算は正の整数で入力してください。' };
  }

  return { ok: true, budget: parsed, transportType };
}
