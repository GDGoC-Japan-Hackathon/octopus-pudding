import { MaterialIcons } from '@expo/vector-icons';
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
  getTripStartErrorMessage,
  groupItineraryByDay,
  parseTripId,
  toPlanDetailViewModel,
} from '@/features/plan-detail/utils/plan-detail';
import {
  createAiPlanGeneration,
  getAiPlanGeneration,
} from '@/features/trips/api/ai-plan-generation';
import { getTripDetail } from '@/features/trips/api/get-trip-detail';
import { startTrip } from '@/features/trips/api/start-trip';
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
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [activeDayId, setActiveDayId] = useState<number | null>(null);
  const headerBackSlot = (
    <Link href="/plans" asChild>
      <Pressable style={styles.headerBackButton}>
        <MaterialIcons name="arrow-back" size={16} color="#EC5B13" />
        <Text style={styles.headerBackButtonText}>戻る</Text>
      </Pressable>
    </Link>
  );

  const groupedItineraryByDay = useMemo(() => groupItineraryByDay(aggregate), [aggregate]);

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

  const handleStartTrip = useCallback(async () => {
    if (!tripId || !aggregate || aggregate.trip.status !== 'planned' || isStartingTrip) {
      return;
    }

    try {
      setIsStartingTrip(true);
      await startTrip(tripId);
      await loadTripDetail();
      Alert.alert('旅行開始', '旅行中のプランを更新しました。ホーム画面にも反映されます。');
    } catch (error) {
      Alert.alert('更新失敗', getTripStartErrorMessage(error));
    } finally {
      setIsStartingTrip(false);
    }
  }, [aggregate, isStartingTrip, loadTripDetail, tripId]);

  if (!tripId) {
    return (
      <View style={styles.screen}>
        <AppHeader title="計画詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} leftSlot={headerBackSlot} />
        <View style={styles.centerState}>
          <Text style={styles.centerTitle}>tripId が不正です</Text>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <AppHeader title="計画詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} leftSlot={headerBackSlot} />
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
        <AppHeader title="計画詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} leftSlot={headerBackSlot} />
        <View style={styles.centerState}>
          <Text style={styles.centerTitle}>計画が見つかりませんでした</Text>
        </View>
      </View>
    );
  }

  if (!detailView) {
    return null;
  }

  const startButtonLabel = isStartingTrip
    ? '旅行開始中...'
    : aggregate.trip.status === 'planned'
      ? '旅行開始'
      : aggregate.trip.status === 'ongoing'
        ? '旅行中'
        : '完了済み';
  const startButtonDisabled = isStartingTrip || aggregate.trip.status !== 'planned';

  return (
    <PlanDetailTemplate
      headerTitle="計画詳細"
      weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`}
      headerLeftSlot={headerBackSlot}
      heroImage={PLAN_IMAGE_URL}
      heroBadge="LIVE MAP PREVIEW"
      title={detailView.title}
      subtitle={detailView.subtitle}
      intro={detailView.intro}
      budgetLabel={detailView.budgetLabel}
      moveTimeLabel={detailView.moveTimeLabel}
      days={detailView.days}
      activeDayKey={detailView.activeDayKey}
      onSelectDay={(dayKey) => setActiveDayId(Number(dayKey))}
      timeline={detailView.timeline}
      primaryActionLabel=""
      primaryActionSlot={
        <View style={styles.actionStack}>
          <Pressable
            style={[styles.startButton, startButtonDisabled ? styles.actionButtonGray : styles.actionButtonOrange]}
            onPress={handleStartTrip}
            disabled={startButtonDisabled}
          >
            <MaterialIcons name="flight-takeoff" size={22} color="#FFFFFF" />
            <Text style={styles.startButtonText}>{startButtonLabel}</Text>
          </Pressable>

          <View style={styles.actionRow}>
            <Link href={{ pathname: '/create/edit', params: { tripId: String(tripId) } }} asChild>
              <Pressable style={[styles.actionButton, styles.actionButtonOrange]}>
                <MaterialIcons name="edit-note" size={22} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>マイプランを{'\n'}編集する</Text>
              </Pressable>
            </Link>

            <Pressable
              style={[styles.actionButton, isGenerating ? styles.actionButtonGray : styles.actionButtonOrange]}
              onPress={handleGenerateAiPlan}
              disabled={isGenerating}
            >
              <MaterialIcons name="auto-awesome" size={22} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{isGenerating ? 'AIで再構築中...' : `AIで再構築\nする`}</Text>
            </Pressable>
          </View>
        </View>
      }
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
  headerBackButton: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  headerBackButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EC5B13',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionStack: {
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minHeight: 88,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  actionButtonOrange: {
    backgroundColor: '#EC5B13',
  },
  actionButtonGray: {
    backgroundColor: '#94A3B8',
  },
  startButton: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});
