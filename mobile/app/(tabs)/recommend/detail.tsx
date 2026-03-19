import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { weatherMock } from '@/data/travel';
import { PlanDetailTemplate } from '@/features/plan-detail/components/PlanDetailTemplate';
import { formatTravelDateLabel } from '@/features/plan-detail/utils/plan-detail';
import { cloneRecommendTrip } from '@/features/recommend/api/clone-recommend-trip';
import { getRecommendPlanDetail } from '@/features/recommend/api/get-recommend-plan-detail';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { deleteTrip } from '@/features/trips/api/delete-trip';
import { getApiErrorMessage } from '@/lib/api/client';

export default function RecommendationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof getRecommendPlanDetail>>>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDayKey, setActiveDayKey] = useState('day1');
  const [isSavedToPlans, setIsSavedToPlans] = useState(false);
  const [savedTripId, setSavedTripId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const detail = await getRecommendPlanDetail(id);
        setPlan(detail);
        setIsSavedToPlans(detail?.isSavedByMe ?? false);
        setSavedTripId(detail?.savedTripId ? Number(detail.savedTripId) : null);
      } catch {
        Alert.alert('取得失敗', 'おすすめ詳細の取得に失敗しました。');
        setPlan(null);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [id]);

  useEffect(() => {
    if (!plan?.days.length) {
      return;
    }

    setActiveDayKey((currentKey) =>
      plan.days.some((day) => day.key === currentKey) ? currentKey : plan.days[0].key
    );
  }, [plan]);

  const activeDay = useMemo(() => {
    if (!plan?.days.length) {
      return null;
    }

    return plan.days.find((day) => day.key === activeDayKey) ?? plan.days[0];
  }, [activeDayKey, plan]);

  const createdAtLabel = useMemo(() => {
    if (!plan?.createdAt) {
      return null;
    }
    const parsed = new Date(plan.createdAt);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return `作成日 ${parsed.getFullYear()}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${String(parsed.getDate()).padStart(2, '0')}`;
  }, [plan?.createdAt]);

  const handlePrimaryAction = async () => {
    if (isSavedToPlans && savedTripId) {
      try {
        await deleteTrip(savedTripId);
        setIsSavedToPlans(false);
        setSavedTripId(null);
      } catch (error) {
        Alert.alert(
          '更新失敗',
          getApiErrorMessage(error, {
            fallback: '保存済みプランの解除に失敗しました',
            unauthorized: 'ログイン状態を確認してください',
            notFound: '保存済みプランが見つかりませんでした',
            defaultWithStatus: true,
          })
        );
      }
      return;
    }

    if (!id) {
      return;
    }

    try {
      const cloned = await cloneRecommendTrip(id, 'use');
      setIsSavedToPlans(true);
      setSavedTripId(cloned.trip_id);
    } catch (error) {
      Alert.alert(
        '保存失敗',
        getApiErrorMessage(error, {
          fallback: 'おすすめプランの保存に失敗しました',
          unauthorized: 'ログイン状態を確認してください',
          notFound: '元のおすすめプランが見つかりませんでした',
          defaultWithStatus: true,
        })
      );
    }
  };

  const handleCustomize = async () => {
    if (!id) {
      return;
    }

    try {
      const cloned = await cloneRecommendTrip(id, 'customize');
      router.push(`/(tabs)/recommend/customize?tripId=${cloned.trip_id}`);
    } catch (error) {
      Alert.alert(
        '保存失敗',
        getApiErrorMessage(error, {
          fallback: 'おすすめプランの取り込みに失敗しました',
          unauthorized: 'ログイン状態を確認してください',
          notFound: '元のおすすめプランが見つかりませんでした',
          defaultWithStatus: true,
        })
      );
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FDFDFD' }}>
        <AppHeader title="おすすめ詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <ActivityIndicator color="#EC5B13" />
          <Text style={{ color: '#64748B', fontSize: 14 }}>読み込み中...</Text>
        </View>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FDFDFD' }}>
        <AppHeader title="おすすめ詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>投稿が見つかりませんでした</Text>
        </View>
      </View>
    );
  }

  return (
    <PlanDetailTemplate
      headerTitle="おすすめ詳細"
      weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`}
      heroImage={plan.image}
      title={plan.title}
      comment={plan.comment}
      createdAtLabel={createdAtLabel}
      travelDateLabel={formatTravelDateLabel(plan.startDate, plan.endDate)}
      budgetLabel={plan.budget}
      moveTimeLabel={plan.moveTime}
      days={plan.days.map((day) => ({ key: day.key, label: day.label }))}
      activeDayKey={activeDay?.key ?? plan.days[0]?.key ?? 'day1'}
      onSelectDay={setActiveDayKey}
      timeline={activeDay?.timeline ?? []}
      primaryActionLabel=""
      primaryActionSlot={
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionButton, isSavedToPlans ? styles.actionButtonSaved : styles.actionButtonOrange]}
            onPress={() => void handlePrimaryAction()}
          >
            <MaterialIcons name="bookmark" size={22} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>{isSavedToPlans ? '保存済み' : 'マイプランに\n保存'}</Text>
          </Pressable>

          <Pressable style={[styles.actionButton, styles.actionButtonOrange]} onPress={() => void handleCustomize()}>
            <MaterialIcons name="edit-note" size={22} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>カスタマイズして{'\n'}マイプランに保存</Text>
          </Pressable>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
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
  actionButtonSaved: {
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
