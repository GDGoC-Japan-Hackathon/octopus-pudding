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
  icon?: keyof typeof MaterialIcons.glyphMap;
};

export type PlanDetailViewModel = {
  title: string;
  subtitle: string;
  intro?: string;
  budgetLabel: string;
  moveTimeLabel: string;
  days: PlanDetailDay[];
  activeDayKey: string;
  timeline: PlanDetailTimelineItem[];
};
