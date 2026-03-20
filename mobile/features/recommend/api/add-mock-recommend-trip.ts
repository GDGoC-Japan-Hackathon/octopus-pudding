import { getMockRecommendPlanSeed, type MockRecommendationItemSeed, type MockRecommendationSeed } from '@/features/recommend/data/mock-recommend';
import { createItineraryItem } from '@/features/trips/api/create-itinerary-item';
import { createTripDay } from '@/features/trips/api/create-trip-day';
import { createTrip } from '@/features/trips/api/create-trip';
import { deleteTrip } from '@/features/trips/api/delete-trip';
import { type CreateTripRequest } from '@/features/trips/types/create-trip';
import { type CreateItineraryItemRequest } from '@/features/trips/types/trip-edit';

function addDays(dateString: string, offset: number) {
  const [year, month, day] = dateString.split('-').map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offset);
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getUTCDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function toDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
}

function toCreateTripPayload(plan: MockRecommendationSeed): CreateTripRequest {
  return {
    origin: plan.origin,
    destination: plan.destination,
    start_date: plan.startDate,
    end_date: plan.endDate,
    participant_count: plan.participantCount,
    cover_image_url: plan.coverImageUrl,
    recommendation_comment: plan.recommendationComment,
    recommendation_categories: [...plan.categories],
    status: 'planned',
    preference: {
      atmosphere: plan.atmosphere,
      companions: plan.companions,
      budget: plan.budgetAmount,
      transport_type: plan.transportType,
    },
  };
}

function toCreateItineraryItemPayload(
  date: string,
  item: MockRecommendationItemSeed
): CreateItineraryItemRequest {
  if (item.kind === 'transport') {
    return {
      name: item.title,
      item_type: 'transport',
      transport_mode: item.transportMode,
      travel_minutes: item.travelMinutes,
      distance_meters: item.distanceMeters,
      from_name: item.fromName,
      to_name: item.toName,
      start_time: toDateTime(date, item.start),
      end_time: toDateTime(date, item.end),
      notes: item.body,
      line_name: item.lineName,
      vehicle_type: item.vehicleType,
      departure_stop_name: item.departureStopName,
      arrival_stop_name: item.arrivalStopName,
    };
  }

  return {
    name: item.title,
    item_type: 'place',
    category: item.category,
    latitude: item.latitude,
    longitude: item.longitude,
    start_time: toDateTime(date, item.start),
    end_time: toDateTime(date, item.end),
    estimated_cost: item.estimatedCost,
    notes: item.body,
  };
}

export async function addMockRecommendTrip(recommendationId: string): Promise<{ tripId: number }> {
  const plan = getMockRecommendPlanSeed(recommendationId);
  if (!plan) {
    throw new Error('Mock recommendation not found');
  }

  let tripId: number | null = null;

  try {
    const createdTrip = await createTrip(toCreateTripPayload(plan));
    tripId = createdTrip.trip.id;

    for (const [index, day] of plan.days.entries()) {
      const dayDate = addDays(plan.startDate, index);
      const createdDay = await createTripDay(tripId, {
        day_number: index + 1,
        date: dayDate,
      });

      for (const item of day.items) {
        await createItineraryItem(tripId, createdDay.id, toCreateItineraryItemPayload(dayDate, item));
      }
    }

    return { tripId };
  } catch (error) {
    if (tripId !== null) {
      try {
        await deleteTrip(tripId);
      } catch {
        // ignore rollback failures and surface the original error
      }
    }
    throw error;
  }
}
