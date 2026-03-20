import { MaterialIcons } from '@expo/vector-icons';

export type PlanDetailDay = {
  key: string;
  label: string;
};

export type PlanDetailTimelineItem = {
  id: string | number;
  start: string;
  end: string;
  title: string;
  body: string;
  itemType?: 'place' | 'transport';
  metaLabel?: string;
  durationLabel?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  lineName?: string;
  vehicleType?: string;
  departureStopName?: string;
  arrivalStopName?: string;
};

export type PlanDetailViewModel = {
  heroImage: string | null;
  title: string;
  comment?: string;
  createdAtLabel?: string | null;
  travelDateLabel?: string | null;
  budgetLabel: string;
  moveTimeLabel: string;
  days: PlanDetailDay[];
  activeDayKey: string;
  timeline: PlanDetailTimelineItem[];
};
