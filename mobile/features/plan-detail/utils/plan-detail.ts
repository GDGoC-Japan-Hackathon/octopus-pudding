import { MaterialIcons } from '@expo/vector-icons';
import {
  type TripDetailAggregateResponse,
  type TripDetailItineraryItemResponse,
} from '@/features/trips/types/trip-detail';
import { type CreateAiPlanGenerationRequest } from '@/features/trips/types/ai-plan-generation';
import { getApiErrorMessage } from '@/lib/api/client';

import { type PlanDetailDay, type PlanDetailTimelineItem, type PlanDetailViewModel } from '@/features/plan-detail/types';
import { type TripStatus } from '@/features/trips/types/trip-status';
import { type TripAtmosphere } from '@/features/trips/types/create-trip';

export function parseTripId(rawTripId?: string): number | null {
  if (!rawTripId) {
    return null;
  }
  const parsed = Number(rawTripId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function getTripDetailErrorMessage(error: unknown): string {
  return getApiErrorMessage(error, {
    fallback: '計画詳細の取得に失敗しました。',
    unauthorized: '認証が切れています。再ログイン後にお試しください。',
    forbidden: 'この計画を閲覧する権限がありません。',
    notFound: '対象の計画が見つかりませんでした。',
    defaultWithStatus: true,
  });
}

export function getAiGenerationErrorMessage(error: unknown): string {
  return getApiErrorMessage(error, {
    fallback: 'AIプラン再構築の実行に失敗しました。',
    unauthorized: '認証が切れています。再ログイン後にお試しください。',
    forbidden: 'この計画でAIプランを作成する権限がありません。',
    notFound: '対象の計画が見つかりませんでした。',
    defaultWithStatus: true,
  });
}

export function buildAiGenerationRequestFromAggregate(
  aggregate: TripDetailAggregateResponse,
  overrides: Partial<CreateAiPlanGenerationRequest> = {}
): CreateAiPlanGenerationRequest {
  const sortedDays = [...aggregate.days].sort((a, b) => a.day_number - b.day_number);
  return {
    run_async: false,
    must_visit_places: (aggregate.preference?.must_visit_places_text ?? '')
      .split(/[\n,、]/)
      .map((item) => item.trim())
      .filter(Boolean),
    lodging_notes: sortedDays.map((day) => day.lodging_note?.trim() ?? ''),
    additional_request_comment: aggregate.preference?.additional_request_comment?.trim() || undefined,
    ...overrides,
  };
}

export function getTripStartErrorMessage(error: unknown): string {
  return getApiErrorMessage(error, {
    fallback: '旅行開始に失敗しました。',
    unauthorized: '認証が切れています。再ログイン後にお試しください。',
    forbidden: 'この計画を開始する権限がありません。',
    notFound: '対象の計画が見つかりませんでした。',
    defaultWithStatus: true,
  });
}

export function toDurationLabel(start?: string | null, end?: string | null) {
  if (!start || !end) {
    return '時間未設定';
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return '時間未設定';
  }
  const minutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  if (hour === 0) {
    return `${minute}m`;
  }
  return `${hour}h ${minute}m`;
}

export function toTimeLabel(value?: string | null) {
  if (!value) {
    return '--:--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDateLabel(prefix: string, value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${prefix} ${year}/${month}/${day}`;
}

export function formatTravelDateLabel(start?: string | null, end?: string | null) {
  const startLabel = formatDateLabel('', start)?.trim();
  const endLabel = formatDateLabel('', end)?.trim();
  if (!startLabel || !endLabel) {
    return null;
  }
  return `旅行日 ${startLabel} - ${endLabel}`;
}

export function budgetLabel(aggregate: TripDetailAggregateResponse) {
  const budget = aggregate.preference?.budget;
  if (!budget) {
    return '未設定';
  }
  return `¥${budget.toLocaleString()}`;
}

export function moveTimeLabel(items: TripDetailItineraryItemResponse[]) {
  if (!items.length) {
    return '未設定';
  }
  const travelMinutes = items.reduce((sum, item) => sum + (item.travel_minutes ?? 0), 0);
  if (travelMinutes > 0) {
    const hour = Math.floor(travelMinutes / 60);
    const minute = travelMinutes % 60;
    if (hour === 0) return `${minute}m`;
    return `${hour}h ${minute}m`;
  }
  const first = items[0];
  const last = items[items.length - 1];
  if (!first.start_time || !last.end_time) {
    return `${items.length}件`;
  }
  return toDurationLabel(first.start_time, last.end_time);
}

export function statusLabel(status: TripStatus | string) {
  if (status === 'planned') return '保存済み';
  if (status === 'ongoing') return '進行中';
  if (status === 'completed') return '完了';
  return status;
}

export function groupItineraryByDay(aggregate: TripDetailAggregateResponse | null) {
  if (!aggregate) {
    return [];
  }

  const dayMap = new Map<number, { dayNumber?: number; date?: string | null }>();
  for (const day of aggregate.days) {
    dayMap.set(day.id, { dayNumber: day.day_number, date: day.date });
  }

  const groups = new Map<
    number,
    {
      tripDayId: number;
      dayNumber?: number;
      date?: string | null;
      items: TripDetailItineraryItemResponse[];
    }
  >();

  for (const item of aggregate.itinerary_items) {
    const dayInfo = dayMap.get(item.trip_day_id);
    const existing = groups.get(item.trip_day_id);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(item.trip_day_id, {
        tripDayId: item.trip_day_id,
        dayNumber: dayInfo?.dayNumber,
        date: dayInfo?.date,
        items: [item],
      });
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => (a.dayNumber ?? 999) - (b.dayNumber ?? 999))
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => {
        const sequenceDiff = (a.sequence ?? 9999) - (b.sequence ?? 9999);
        if (sequenceDiff !== 0) {
          return sequenceDiff;
        }

        const startDiff = (a.start_time ?? '').localeCompare(b.start_time ?? '');
        if (startDiff !== 0) {
          return startDiff;
        }

        return a.id - b.id;
      }),
    }));
}

export function toTimelineItems(items: TripDetailItineraryItemResponse[]): PlanDetailTimelineItem[] {
  return items.map((item) => ({
    id: item.id,
    start: toTimeLabel(item.start_time),
    end: toTimeLabel(item.end_time),
    title: item.item_type === 'transport' ? transportModeLabel(item.transport_mode) : item.name,
    body:
      item.item_type === 'transport'
        ? typeof item.notes === 'string' && item.notes.includes('公共交通機関が取得できませんでした')
          ? item.notes
          : item.departure_stop_name && item.arrival_stop_name
          ? `${item.departure_stop_name} → ${item.arrival_stop_name}`
          : item.from_name && item.to_name
          ? `${item.from_name} → ${item.to_name}`
          : item.notes || '移動'
        : item.notes || item.category || '詳細メモは未設定です。',
    itemType: item.item_type === 'transport' ? 'transport' : 'place',
    metaLabel:
      item.item_type === 'transport'
        ? buildTransportMetaLabel(item.transport_mode, item.line_name, item.travel_minutes, item.distance_meters)
        : undefined,
    durationLabel:
      item.item_type === 'transport'
        ? toTransportDurationLabel(item.travel_minutes, item.start_time, item.end_time)
        : toDurationLabel(item.start_time, item.end_time),
    icon:
      item.item_type === 'transport'
        ? transportModeIcon(item.transport_mode)
        : item.category === 'food'
        ? 'restaurant'
        : item.category === 'transport'
          ? 'train'
          : 'place',
    lineName: item.line_name ?? undefined,
    vehicleType: item.vehicle_type ?? undefined,
    departureStopName: item.departure_stop_name ?? undefined,
    arrivalStopName: item.arrival_stop_name ?? undefined,
  }));
}

function transportModeLabel(mode?: string | null) {
  if (!mode) return '移動';
  if (mode === 'WALK') return '徒歩で移動';
  if (mode === 'BUS') return 'バスで移動';
  if (mode === 'CAR') return '車で移動';
  return '電車で移動';
}

function transportModeIcon(mode?: string | null): keyof typeof MaterialIcons.glyphMap {
  if (!mode) return 'swap-horiz';
  if (mode === 'WALK') return 'directions-walk';
  if (mode === 'BUS') return 'directions-bus';
  if (mode === 'CAR') return 'directions-car';
  return 'train';
}

function buildTransportMetaLabel(
  transportMode?: string | null,
  lineName?: string | null,
  travelMinutes?: number | null,
  distanceMeters?: number | null
) {
  const parts: string[] = [];
  if (lineName) {
    parts.push(lineName);
  } else if (transportMode === 'BUS' || transportMode === 'TRAIN') {
    parts.push('公共交通');
  }
  if (typeof distanceMeters === 'number') {
    parts.push(distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(1)}km` : `${distanceMeters}m`);
  }
  return parts.join(' / ') || undefined;
}

function toTransportDurationLabel(
  travelMinutes?: number | null,
  start?: string | null,
  end?: string | null
) {
  if (typeof travelMinutes === 'number' && travelMinutes > 0) {
    return `${travelMinutes}分`;
  }
  return toDurationLabel(start, end);
}

export function toPlanDetailViewModel(
  aggregate: TripDetailAggregateResponse,
  activeDayId: number | null
): PlanDetailViewModel {
  const groupedItineraryByDay = groupItineraryByDay(aggregate);
  const activeDay =
    groupedItineraryByDay.find((group) => group.tripDayId === activeDayId) ?? groupedItineraryByDay[0] ?? null;

  const days: PlanDetailDay[] = groupedItineraryByDay.length
    ? groupedItineraryByDay.map((group, index) => ({
        key: String(group.tripDayId),
        label: `Day ${group.dayNumber ?? index + 1}`,
      }))
    : [{ key: 'day1', label: 'Day 1' }];

  return {
    heroImage: aggregate.trip.cover_image_url ?? null,
    title: `${aggregate.trip.origin} → ${aggregate.trip.destination}`,
    comment:
      aggregate.trip.recommendation_comment ??
      buildRecommendationComment(
        aggregate.trip.destination,
        aggregate.preference?.companions,
        aggregate.preference?.atmosphere,
        aggregate.trip.recommendation_categories ?? []
      ),
    createdAtLabel: formatDateLabel('作成日', aggregate.trip.created_at),
    travelDateLabel: formatTravelDateLabel(aggregate.trip.start_date, aggregate.trip.end_date),
    budgetLabel: budgetLabel(aggregate),
    moveTimeLabel: moveTimeLabel(aggregate.itinerary_items),
    days,
    activeDayKey: activeDay ? String(activeDay.tripDayId) : 'day1',
    timeline: activeDay ? toTimelineItems(activeDay.items) : [],
  };
}

function buildRecommendationComment(
  destination: string,
  companions?: string | null,
  atmosphere?: TripAtmosphere | null,
  recommendationCategories?: string[] | null
) {
  const target = commentTargetPhrase(destination, companions);
  const vibe = commentVibePhrase(atmosphere);
  const categoryHint = commentCategoryPhrase(recommendationCategories ?? []);
  if (categoryHint) {
    return `${target} ${vibe}、${categoryHint}プランです。`;
  }
  return `${target} ${vibe}体験型プランです。`;
}

function commentTargetPhrase(destination: string, companions?: string | null) {
  const normalized = companions?.trim().toLowerCase();
  if (normalized === 'couple') return 'デートにおすすめ！';
  if (normalized === 'friends') return '友達同士におすすめ！';
  if (normalized === 'family') return '家族旅行におすすめ！';
  if (normalized === 'solo') return 'ひとり旅におすすめ！';
  if (destination) return `${destination}観光におすすめ！`;
  return '気軽なおでかけにおすすめ！';
}

function commentVibePhrase(atmosphere?: TripAtmosphere | null) {
  if (atmosphere === 'のんびり') return 'のんびり楽しめる';
  if (atmosphere === 'アクティブ') return 'アクティブに回れる';
  if (atmosphere === '映え') return '写真映えを楽しめる';
  if (atmosphere === 'グルメ') return 'グルメを満喫できる';
  return '気軽に楽しめる';
}

function commentCategoryPhrase(recommendationCategories: string[]) {
  if (recommendationCategories.includes('夜景')) return '夜まで楽しめる';
  if (recommendationCategories.includes('グルメ')) return '食べ歩きも楽しめる';
  if (recommendationCategories.includes('温泉')) return '癒やしも味わえる';
  if (recommendationCategories.includes('カフェ')) return 'カフェ巡りを楽しめる';
  return null;
}
