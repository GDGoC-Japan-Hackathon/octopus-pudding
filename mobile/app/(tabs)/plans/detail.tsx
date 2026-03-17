import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { weatherMock } from '@/data/travel';
import { PlanDetailTemplate } from '@/features/plan-detail/components/PlanDetailTemplate';
import {
  getAiGenerationErrorMessage,
  getTripDetailErrorMessage,
  groupItineraryByDay,
  parseTripId,
  toPlanDetailViewModel,
} from '@/features/plan-detail/utils/plan-detail';
import {
  createAiPlanGeneration,
  getAiPlanGeneration,
} from '@/features/trips/api/ai-plan-generation';
import { getTripDetail } from '@/features/trips/api/get-trip-detail';
import { type AiPlanGenerationResponse } from '@/features/trips/types/ai-plan-generation';
import { type TripDetailAggregateResponse } from '@/features/trips/types/trip-detail';
import { AppHeader } from '@/features/travel/components/AppHeader';

const PLAN_IMAGE_URL =
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80';

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const tripId = useMemo(() => parseTripId(id), [id]);
  const [aggregate, setAggregate] = useState<TripDetailAggregateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [generation, setGeneration] = useState<AiPlanGenerationResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeDayId, setActiveDayId] = useState<number | null>(null);

  const groupedItineraryByDay = useMemo(() => groupItineraryByDay(aggregate), [aggregate]);

  const activeDay = useMemo(() => {
    if (!groupedItineraryByDay.length) {
      return null;
    }
    return groupedItineraryByDay.find((group) => group.tripDayId === activeDayId) ?? groupedItineraryByDay[0];
  }, [activeDayId, groupedItineraryByDay]);

  const detailView = useMemo(
    () => (aggregate ? toPlanDetailViewModel(aggregate, activeDayId) : null),
    [activeDayId, aggregate]
  );

  const loadTripDetail = useCallback(async () => {
    if (!tripId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const detail = await getTripDetail(tripId);
      setAggregate(detail);
    } catch (error) {
      Alert.alert('取得失敗', getTripDetailErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void loadTripDetail();
  }, [loadTripDetail]);

  useEffect(() => {
    if (groupedItineraryByDay.length && activeDayId === null) {
      setActiveDayId(groupedItineraryByDay[0].tripDayId);
    }
  }, [activeDayId, groupedItineraryByDay]);

  useEffect(() => {
    if (!tripId || !generation || (generation.status !== 'queued' && generation.status !== 'running')) {
      return;
    }

    const intervalId = setInterval(() => {
      void (async () => {
        try {
          const latest = await getAiPlanGeneration(tripId, generation.id);
          setGeneration(latest);

          if (latest.status === 'succeeded') {
            clearInterval(intervalId);
            setIsGenerating(false);
            Alert.alert('AIプラン構築完了', '行程を更新しました。');
            void loadTripDetail();
          } else if (latest.status === 'failed') {
            clearInterval(intervalId);
            setIsGenerating(false);
            Alert.alert('AIプラン構築失敗', latest.error_message ?? 'プラン構築に失敗しました。');
          }
        } catch (error) {
          clearInterval(intervalId);
          setIsGenerating(false);
          Alert.alert('取得失敗', getAiGenerationErrorMessage(error));
        }
      })();
    }, 3000);

    return () => clearInterval(intervalId);
  }, [generation, loadTripDetail, tripId]);

  const handleGenerateAiPlan = useCallback(async () => {
    if (!tripId) {
      return;
    }
    try {
      setIsGenerating(true);
      const created = await createAiPlanGeneration(tripId, { run_async: true });
      setGeneration(created);
      if (created.status === 'succeeded') {
        setIsGenerating(false);
        void loadTripDetail();
      }
    } catch (error) {
      setIsGenerating(false);
      Alert.alert('実行失敗', getAiGenerationErrorMessage(error));
    }
  }, [loadTripDetail, tripId]);

  if (!tripId) {
    return (
      <View style={styles.screen}>
        <AppHeader title="計画詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
        <View style={styles.centerState}>
          <Text style={styles.centerTitle}>tripId が不正です</Text>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <AppHeader title="計画詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
        <View style={styles.centerState}>
          <ActivityIndicator color="#EC5B13" />
          <Text style={styles.centerBody}>読み込み中...</Text>
        </View>
      </View>
    );
  }

  if (!aggregate) {
    return (
      <View style={styles.screen}>
        <AppHeader title="計画詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
        <View style={styles.centerState}>
          <Text style={styles.centerTitle}>計画が見つかりませんでした</Text>
        </View>
      </View>
    );
  }

  if (!detailView) {
    return null;
  }

  return (
    <PlanDetailTemplate
      headerTitle="計画詳細"
      weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`}
      heroImage={PLAN_IMAGE_URL}
      heroBadge="LIVE MAP PREVIEW"
      title={detailView.title}
      subtitle={detailView.subtitle}
      budgetLabel={detailView.budgetLabel}
      moveTimeLabel={detailView.moveTimeLabel}
      days={detailView.days}
      activeDayKey={detailView.activeDayKey}
      onSelectDay={(dayKey) => setActiveDayId(Number(dayKey))}
      timeline={detailView.timeline}
      primaryActionLabel="このプランにする"
      primaryActionSlot={
        <Link href={{ pathname: '/create/edit', params: { tripId: String(tripId) } }} asChild>
          <Pressable style={{ height: 54, borderRadius: 18, backgroundColor: '#EC5B13', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>このプランにする</Text>
          </Pressable>
        </Link>
      }
      secondaryActionLabel={isGenerating ? 'AIで再構築中...' : 'カスタマイズする'}
      onSecondaryAction={handleGenerateAiPlan}
      secondaryActionDisabled={isGenerating}
      footerSlot={
        generation ? (
          <View style={{ borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>AI構築ステータス</Text>
            <Text style={{ fontSize: 13, color: '#475569' }}>status: {generation.status}</Text>
            {generation.error_message ? <Text style={{ fontSize: 13, color: '#475569' }}>{generation.error_message}</Text> : null}
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FDFDFD',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  centerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  centerBody: {
    fontSize: 14,
    color: '#64748B',
  },
});
