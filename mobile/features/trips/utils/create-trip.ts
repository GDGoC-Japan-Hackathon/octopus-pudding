import { type CreateTripRequest } from '@/features/trips/types/create-trip';

export type CreateTripFormValues = {
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  participantCount: string;
  budget: string;
};

export type CreateTripValidationResult =
  | {
      ok: true;
      payload: CreateTripRequest;
    }
  | {
      ok: false;
      message: string;
    };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateAndBuildCreateTripPayload(
  values: CreateTripFormValues
): CreateTripValidationResult {
  const origin = values.origin.trim();
  const destination = values.destination.trim();
  const startDate = values.startDate.trim();
  const endDate = values.endDate.trim();
  const participantCountText = values.participantCount.trim();
  const budgetText = values.budget.trim();

  if (!origin || !destination || !startDate || !endDate) {
    return {
      ok: false,
      message: '出発地・目的地・日程は必須です。',
    };
  }

  const participantCount = Number(participantCountText);
  if (!Number.isInteger(participantCount) || participantCount < 1) {
    return {
      ok: false,
      message: '人数は1以上の整数で入力してください。',
    };
  }

  if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) {
    return {
      ok: false,
      message: '日付は YYYY-MM-DD 形式で入力してください。',
    };
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return {
      ok: false,
      message: '終了日は出発日以降の日付を入力してください。',
    };
  }

  let budget: number | undefined;
  if (budgetText) {
    const parsedBudget = Number(budgetText);
    if (!Number.isInteger(parsedBudget) || parsedBudget <= 0) {
      return {
        ok: false,
        message: '予算は正の整数で入力してください。',
      };
    }
    budget = parsedBudget;
  }

  return {
    ok: true,
    payload: {
      origin,
      destination,
      start_date: startDate,
      end_date: endDate,
      participant_count: participantCount,
      status: 'planned',
      preference: budget
        ? {
            atmosphere: 'のんびり',
            budget,
          }
        : undefined,
    },
  };
}
