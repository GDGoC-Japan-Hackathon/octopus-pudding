import { type CreateAiPlanGenerationRequest } from '@/features/trips/types/ai-plan-generation';
import { type TripDetailAggregateResponse } from '@/features/trips/types/trip-detail';
import { type CreateTripFormValues } from '@/features/trips/utils/create-trip';
import { defaultCreateTripFormValues } from '@/features/trips/utils/create-trip-draft';
import * as Location from 'expo-location';

export function buildTripPlanFormValues(detail: TripDetailAggregateResponse): CreateTripFormValues {
  const participantCount = Math.max(1, detail.trip.participant_count ?? 1);
  const totalBudget = detail.preference?.budget ?? 0;
  const budgetPerPerson = totalBudget > 0 ? Math.trunc(totalBudget / participantCount) : Number(defaultCreateTripFormValues.budget);

  const sortedDays = [...detail.days].sort((a, b) => a.day_number - b.day_number);
  const accommodationNotesByDay = [...defaultCreateTripFormValues.accommodationNotesByDay];
  for (let index = 0; index < accommodationNotesByDay.length; index += 1) {
    accommodationNotesByDay[index] = sortedDays[index]?.lodging_note?.trim() ?? '';
  }

  return {
    origin: detail.trip.origin ?? '',
    destination: detail.trip.destination ?? '',
    startDate: detail.trip.start_date ?? '',
    endDate: detail.trip.end_date ?? '',
    participantCount: String(participantCount),
    budget: String(budgetPerPerson),
    atmosphere: detail.preference?.atmosphere ?? defaultCreateTripFormValues.atmosphere,
    recommendationCategories: detail.trip.recommendation_categories ?? [],
    transportTypes: [],
    mustVisitPlacesText: detail.preference?.must_visit_places_text?.trim() ?? '',
    accommodationNotesByDay,
    additionalRequestComment: detail.preference?.additional_request_comment?.trim() ?? '',
  };
}

async function geocodeToLatLng(label: string, fieldLabel: string) {
  const query = label.trim();
  if (!query) {
    throw new Error(`${fieldLabel}が未入力です。`);
  }
  const results = await Location.geocodeAsync(query);
  const top = results[0];
  if (!top) {
    throw new Error(`${fieldLabel}の座標を特定できませんでした。入力を確認してください。`);
  }
  return {
    latitude: top.latitude,
    longitude: top.longitude,
  };
}

export async function buildAiGenerationRequestFromForm(
  formValues: CreateTripFormValues
): Promise<CreateAiPlanGenerationRequest> {
  const [origin, destination] = await Promise.all([
    geocodeToLatLng(formValues.origin, '出発地'),
    geocodeToLatLng(formValues.destination, '目的地'),
  ]);
  const lodgingLabel = formValues.accommodationNotesByDay.find((item) => item.trim());
  const lodging = lodgingLabel ? await geocodeToLatLng(lodgingLabel, '宿泊地') : undefined;

  return {
    origin,
    destination,
    lodging,
    run_async: false,
    must_visit_places: formValues.mustVisitPlacesText
      .split(/[\n,、]/)
      .map((item) => item.trim())
      .filter(Boolean),
    lodging_notes: formValues.accommodationNotesByDay.map((item) => item.trim()),
    additional_request_comment: formValues.additionalRequestComment.trim() || undefined,
  };
}
