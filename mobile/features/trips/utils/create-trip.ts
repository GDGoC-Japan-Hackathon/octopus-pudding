import { type CreateTripRequest, type TripAtmosphere } from '@/features/trips/types/create-trip';

export type CreateTripFormValues = {
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  participantCount: string;
  budget: string;
  atmosphere: string;
  recommendationCategories: string[];
  transportTypes: string[];
  mustVisitPlacesText: string;
  accommodationNotesByDay: string[];
  additionalRequestComment: string;
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
const FALLBACK_ATMOSPHERE: TripAtmosphere = 'のんびり';
const LOCATION_SUSPECT_WORDS = new Set(['test', 'testing', 'aaa', 'aaaa', 'abcde', 'qwerty']);

function isLikelyNoiseLocation(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  const normalized = trimmed.toLowerCase();
  if (LOCATION_SUSPECT_WORDS.has(normalized)) {
    return true;
  }
  if (/^\d+$/.test(normalized)) {
    return true;
  }
  if (/^([a-z0-9])\1{2,}$/i.test(normalized)) {
    return true;
  }
  if (trimmed.length < 2 && !/[駅空港市区町村県都道府]/.test(trimmed)) {
    return true;
  }
  return false;
}

export function validateAndBuildCreateTripPayload(
  values: CreateTripFormValues
): CreateTripValidationResult {
  const origin = values.origin.trim();
  const destination = values.destination.trim();
  const startDate = values.startDate.trim();
  const endDate = values.endDate.trim();
  const participantCountText = values.participantCount.trim();
  const budgetText = values.budget.trim();
  const atmosphere = values.atmosphere.trim();
  const recommendationCategories = values.recommendationCategories;
  if (!origin || !destination || !startDate || !endDate) {
    return {
      ok: false,
      message: '必須項目が未入力です',
    };
  }
  if (isLikelyNoiseLocation(origin)) {
    return {
      ok: false,
      message: '出発地の入力を確認してください。',
    };
  }
  if (isLikelyNoiseLocation(destination)) {
    return {
      ok: false,
      message: '目的地の入力を確認してください。',
    };
  }

  const participantCount = Number(participantCountText);
  if (!Number.isInteger(participantCount) || participantCount < 1) {
    return {
      ok: false,
      message: '人数は1以上の整数で入力してください。',
    };
  }
  if (participantCount > 10) {
    return {
      ok: false,
      message: '人数は10人以下で入力してください。',
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
  const tripDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (tripDays > 3) {
    return {
      ok: false,
      message: 'プラン作成は最大3日間までです。',
    };
  }

  if (!budgetText) {
    return {
      ok: false,
      message: '予算は必須です。',
    };
  }
  const parsedBudgetPerPerson = Number(budgetText);
  if (!Number.isInteger(parsedBudgetPerPerson) || parsedBudgetPerPerson <= 0) {
    return {
      ok: false,
      message: '予算は1人あたりの正の整数で入力してください。',
    };
  }
  if (parsedBudgetPerPerson > 100000) {
    return {
      ok: false,
      message: '予算は1人あたり10万円以下で入力してください。',
    };
  }
  const budget = parsedBudgetPerPerson * participantCount;

  const safeAtmosphere: TripAtmosphere = atmosphere
    ? (atmosphere as TripAtmosphere)
    : FALLBACK_ATMOSPHERE;

  return {
    ok: true,
    payload: {
      origin,
      destination,
      start_date: startDate,
      end_date: endDate,
      participant_count: participantCount,
      recommendation_categories: recommendationCategories,
      status: 'planned',
      preference: {
        atmosphere: safeAtmosphere,
        budget,
        transport_type: 'train,bus',
        must_visit_places_text: values.mustVisitPlacesText.trim() || undefined,
        additional_request_comment: values.additionalRequestComment.trim() || undefined,
      },
    },
  };
}
