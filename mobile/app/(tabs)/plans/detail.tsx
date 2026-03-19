import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
} from '@/features/trips/api/ai-plan-generation';
import { getTripDetail } from '@/features/trips/api/get-trip-detail';
import { type TripDetailAggregateResponse } from '@/features/trips/types/trip-detail';
import { AppHeader } from '@/features/travel/components/AppHeader';

const PLAN_IMAGE_URL =
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80';

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const tripId = useMemo(() => parseTripId(id), [id]);
  const [aggregate, setAggregate] = useState<TripDetailAggregateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAgain, setIsSavingAgain] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [activeDayId, setActiveDayId] = useState<number | null>(null);
  const headerBackSlot = (
    <Pressable style={styles.headerBackButton} onPress={() => router.push('/plans')}>
      <MaterialIcons name="arrow-back" size={16} color="#EC5B13" />
      <Text style={styles.headerBackButtonText}>戻る</Text>
    </Pressable>
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

  const handleSaveToMyPlans = useCallback(async () => {
    if (!tripId) {
      return;
    }
    try {
      setIsSavingAgain(true);
      await createAiPlanGeneration(tripId, { run_async: false });
      void loadTripDetail();
      Alert.alert('保存完了', 'マイプランに保存しました。');
    } catch (error) {
      Alert.alert('保存失敗', getAiGenerationErrorMessage(error));
    } finally {
      setIsSavingAgain(false);
    }
  }, [loadTripDetail, tripId]);

  const handleCustomizeAndSave = useCallback(async () => {
    if (!tripId) {
      return;
    }
    try {
      setIsCustomizing(true);
      router.push({ pathname: '/create/edit', params: { tripId: String(tripId) } });
    } finally {
      setIsCustomizing(false);
    }
  }, [router, tripId]);

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

  return (
    <PlanDetailTemplate
      headerTitle="マイプラン詳細"
      weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`}
      headerLeftSlot={headerBackSlot}
      heroImage={PLAN_IMAGE_URL}
      title={detailView.title}
      comment={detailView.comment}
      createdAtLabel={detailView.createdAtLabel}
      travelDateLabel={detailView.travelDateLabel}
      budgetLabel={detailView.budgetLabel}
      moveTimeLabel={detailView.moveTimeLabel}
      days={detailView.days}
      activeDayKey={detailView.activeDayKey}
      onSelectDay={(dayKey) => setActiveDayId(Number(dayKey))}
      timeline={detailView.timeline}
      primaryActionLabel=""
      primaryActionSlot={
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionButton, isSavingAgain ? styles.actionButtonGray : styles.actionButtonOrange]}
            onPress={handleSaveToMyPlans}
            disabled={isSavingAgain}
          >
            <MaterialIcons name="bookmark" size={22} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              {isSavingAgain ? 'マイプランに\n保存中...' : 'マイプランに\n保存'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.actionButton, isCustomizing ? styles.actionButtonGray : styles.actionButtonOrange]}
            onPress={handleCustomizeAndSave}
            disabled={isCustomizing}
          >
            <MaterialIcons name="edit-note" size={22} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              {isCustomizing ? 'カスタマイズへ\n移動中...' : 'カスタマイズして\nマイプランに保存'}
            </Text>
          </Pressable>
        </View>
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
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
    minHeight: 36,
  },
});
