import { groupItineraryByDay, toTimeLabel } from '@/features/plan-detail/utils/plan-detail';
import { type TripDetailAggregateResponse, type TripDetailItineraryItemResponse } from '@/features/trips/types/trip-detail';
import { type TripResponse } from '@/features/trips/types/trip-edit';

export type HomeTimelineItem = {
  id: number;
  time: string;
  place: string;
  memo: string;
};

export type HomeOngoingTripView = {
  dayLabel: string | null;
  currentItem: HomeTimelineItem | null;
  nextItem: HomeTimelineItem | null;
  hasTimeline: boolean;
};

function parseTimestamp(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.slice(0, 10).replace(/\//g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function compareUpdatedAtDesc(a: TripResponse, b: TripResponse) {
  const aUpdatedAt = parseTimestamp(a.updated_at) ?? Number.NEGATIVE_INFINITY;
  const bUpdatedAt = parseTimestamp(b.updated_at) ?? Number.NEGATIVE_INFINITY;

  if (aUpdatedAt !== bUpdatedAt) {
    return bUpdatedAt - aUpdatedAt;
  }

  return b.id - a.id;
}

function toTimelineMemo(item: TripDetailItineraryItemResponse) {
  if (item.item_type === 'transport' && item.from_name && item.to_name) {
    return `${item.from_name} → ${item.to_name}`;
  }

  return item.notes || item.category || '詳細メモは未設定です。';
}

function toTimelinePlace(item: TripDetailItineraryItemResponse) {
  if (item.item_type === 'transport' && item.from_name && item.to_name) {
    return `${item.from_name} → ${item.to_name}`;
  }

  return item.name;
}

function toHomeTimelineItem(item?: TripDetailItineraryItemResponse | null): HomeTimelineItem | null {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    time: toTimeLabel(item.start_time),
    place: toTimelinePlace(item),
    memo: toTimelineMemo(item),
  };
}

function resolveTimelineItems(items: TripDetailItineraryItemResponse[]): Pick<HomeOngoingTripView, 'currentItem' | 'nextItem' | 'hasTimeline'> {
  if (!items.length) {
    return {
      currentItem: null,
      nextItem: null,
      hasTimeline: false,
    };
  }

  const now = Date.now();
  const currentIndex = items.findIndex((item) => {
    const start = parseTimestamp(item.start_time);
    const end = parseTimestamp(item.end_time);

    if (start === null || end === null) {
      return false;
    }

    return start <= now && now < end;
  });

  if (currentIndex >= 0) {
    return {
      currentItem: toHomeTimelineItem(items[currentIndex]),
      nextItem: toHomeTimelineItem(items[currentIndex + 1]),
      hasTimeline: true,
    };
  }

  return {
    currentItem: toHomeTimelineItem(items[0]),
    nextItem: toHomeTimelineItem(items[1]),
    hasTimeline: true,
  };
}

export function selectFeaturedOngoingTrip(trips: TripResponse[]): TripResponse | null {
  const ongoingTrips = trips.filter((trip) => trip.status === 'ongoing');
  if (!ongoingTrips.length) {
    return null;
  }

  return [...ongoingTrips].sort(compareUpdatedAtDesc)[0] ?? null;
}

export function buildHomeOngoingTripView(aggregate: TripDetailAggregateResponse): HomeOngoingTripView {
  const groups = groupItineraryByDay(aggregate);
  const todayKey = toLocalDateKey();
  const activeGroup = groups.find((group) => normalizeDate(group.date) === todayKey) ?? groups[0] ?? null;

  if (!activeGroup) {
    return {
      dayLabel: null,
      currentItem: null,
      nextItem: null,
      hasTimeline: false,
    };
  }

  const resolvedTimeline = resolveTimelineItems(activeGroup.items);
  const formattedDate = normalizeDate(activeGroup.date)?.replace(/-/g, '/');
  const dayLabel = activeGroup.dayNumber ? `Day ${activeGroup.dayNumber}` : 'Day 1';

  return {
    dayLabel: formattedDate ? `${dayLabel} ・ ${formattedDate}` : dayLabel,
    ...resolvedTimeline,
  };
}
