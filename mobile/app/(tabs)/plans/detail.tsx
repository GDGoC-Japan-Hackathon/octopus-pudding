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
import { BackButton } from '@/components/back-button';
import { PlanDetailTemplate } from '@/features/plan-detail/components/PlanDetailTemplate';
import {
  buildAiGenerationRequestFromAggregate,
  getAiGenerationErrorMessage,
  getTripStartErrorMessage,
  getTripDetailErrorMessage,
  groupItineraryByDay,
  parseTripId,
  toPlanDetailViewModel,
} from '@/features/plan-detail/utils/plan-detail';
import { createAiPlanGeneration } from '@/features/trips/api/ai-plan-generation';
import { getTripDetail } from '@/features/trips/api/get-trip-detail';
import { startTrip } from '@/features/trips/api/start-trip';
import { type PlanDetailTimelineItem } from '@/features/plan-detail/types';
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
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [activeRegenerationKey, setActiveRegenerationKey] = useState<string | null>(null);
  const [activeDayId, setActiveDayId] = useState<number | null>(null);
  const headerBackSlot = <BackButton onPress={() => router.push('/plans')} size={28} />;

  const groupedItineraryByDay = useMemo(() => groupItineraryByDay(aggregate), [aggregate]);

  const detailView = useMemo(
    () => (aggregate ? toPlanDetailViewModel(aggregate, activeDayId) : null),
    [activeDayId, aggregate]
  );
  const regenerationMessage = useMemo(() => {
    if (activeRegenerationKey === 'full') {
      return '旅程全体を再生成しています。しばらくお待ちください。';
    }
    if (activeRegenerationKey?.startsWith('from_item:')) {
      return '選択したスポット以降の旅程を再生成しています。しばらくお待ちください。';
    }
    if (activeRegenerationKey?.startsWith('replace_item:')) {
      return '選択したスポットを差し替えています。しばらくお待ちください。';
    }
    return null;
  }, [activeRegenerationKey]);

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

  const handleStartTrip = useCallback(async () => {
    if (!tripId || aggregate?.trip.status !== 'planned') {
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
  }, [aggregate?.trip.status, loadTripDetail, tripId]);

  const handleRegeneration = useCallback(
    async (
      mode: 'full' | 'from_item' | 'replace_item',
      targetItemId?: number
    ) => {
      if (!tripId || !aggregate) {
        return;
      }

      const regenerationKey = mode === 'full' ? 'full' : `${mode}:${targetItemId}`;
      try {
        setActiveRegenerationKey(regenerationKey);
        const response = await createAiPlanGeneration(
          tripId,
          buildAiGenerationRequestFromAggregate(aggregate, {
            regeneration_mode: mode,
            target_item_id: targetItemId,
          })
        );

        if (response.status === 'failed') {
          Alert.alert('再構成失敗', response.error_message ?? 'AIプランの再構成に失敗しました。');
          return;
        }

        await loadTripDetail();
        Alert.alert(
          '再構成完了',
          mode === 'full'
            ? '旅程全体を再構成しました。'
            : mode === 'from_item'
              ? '選択したスポット以降の旅程を再構成しました。'
              : '選択したスポットを差し替えました。'
        );
      } catch (error) {
        Alert.alert('再構成失敗', getAiGenerationErrorMessage(error));
      } finally {
        setActiveRegenerationKey(null);
      }
    },
    [aggregate, loadTripDetail, tripId]
  );

  const handleRegenerateFromItem = useCallback(
    async (item: PlanDetailTimelineItem) => {
      const itemId = Number(item.id);
      if (!Number.isInteger(itemId) || itemId <= 0) {
        return;
      }
      await handleRegeneration('from_item', itemId);
    },
    [handleRegeneration]
  );

  const handleReplaceItem = useCallback(
    async (item: PlanDetailTimelineItem) => {
      const itemId = Number(item.id);
      if (!Number.isInteger(itemId) || itemId <= 0) {
        return;
      }
      await handleRegeneration('replace_item', itemId);
    },
    [handleRegeneration]
  );

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
      topNoticeMessage={regenerationMessage}
      headerLeftSlot={headerBackSlot}
      heroImage={detailView.heroImage ?? PLAN_IMAGE_URL}
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
      timelinePrimaryActionLabel="ここ以降を再生成"
      onTimelinePrimaryAction={(item) => void handleRegenerateFromItem(item)}
      timelineSecondaryActionLabel="差し替え"
      onTimelineSecondaryAction={(item) => void handleReplaceItem(item)}
      timelineActionLoadingId={
        activeRegenerationKey?.startsWith('from_item:') || activeRegenerationKey?.startsWith('replace_item:')
          ? Number(activeRegenerationKey.split(':')[1])
          : null
      }
      primaryActionLabel=""
      primaryActionSlot={
        <View style={styles.actionWrap}>
          <Pressable
            style={[
              styles.actionButton,
              activeRegenerationKey === 'full' ? styles.actionButtonGray : styles.actionButtonOrange,
            ]}
            onPress={() => void handleRegeneration('full')}
            disabled={activeRegenerationKey !== null}
          >
            <MaterialIcons name="auto-awesome" size={22} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              {activeRegenerationKey === 'full' ? '旅程を再構成中...' : '旅程を全体再生成'}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.actionButton,
              isCustomizing || activeRegenerationKey !== null ? styles.actionButtonGray : styles.actionButtonOrange,
            ]}
            onPress={handleCustomizeAndSave}
            disabled={isCustomizing || activeRegenerationKey !== null}
          >
            <MaterialIcons name="edit-note" size={22} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              {isCustomizing ? 'カスタマイズへ\n移動中...' : 'プランをカスタマイズ'}
            </Text>
          </Pressable>

          {aggregate.trip.status !== 'completed' ? (
            <Pressable
              style={[
                styles.actionButton,
                aggregate.trip.status === 'planned' && !isStartingTrip
                  && activeRegenerationKey === null
                  ? styles.actionButtonWhite
                  : styles.actionButtonGray,
              ]}
              onPress={handleStartTrip}
              disabled={aggregate.trip.status !== 'planned' || isStartingTrip || activeRegenerationKey !== null}
            >
              <MaterialIcons
                name="flight-takeoff"
                size={22}
                color={aggregate.trip.status === 'planned' && !isStartingTrip && activeRegenerationKey === null ? '#EC5B13' : '#FFFFFF'}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  aggregate.trip.status === 'planned' && !isStartingTrip && activeRegenerationKey === null
                    ? styles.actionButtonTextOrange
                    : null,
                ]}
              >
                {isStartingTrip ? '旅行開始中...' : aggregate.trip.status === 'ongoing' ? '旅行中' : '旅行開始'}
              </Text>
            </Pressable>
          ) : null}
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
  actionWrap: {
    width: '100%',
    gap: 12,
  },
  actionButton: {
    width: '100%',
    minHeight: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionButtonOrange: {
    backgroundColor: '#EC5B13',
  },
  actionButtonGray: {
    backgroundColor: '#94A3B8',
  },
  actionButtonWhite: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionButtonTextOrange: {
    color: '#EC5B13',
  },
});
