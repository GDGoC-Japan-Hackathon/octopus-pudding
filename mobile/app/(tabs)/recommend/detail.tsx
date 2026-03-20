import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { weatherMock } from '@/data/travel';
import { PlanDetailTemplate } from '@/features/plan-detail/components/PlanDetailTemplate';
import { formatTravelDateLabel } from '@/features/plan-detail/utils/plan-detail';
import { addMockRecommendTrip } from '@/features/recommend/api/add-mock-recommend-trip';
import { cloneRecommendTrip } from '@/features/recommend/api/clone-recommend-trip';
import { getRecommendPlanDetail } from '@/features/recommend/api/get-recommend-plan-detail';
import { isMockRecommendPlanId } from '@/features/recommend/data/mock-recommend';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { getApiErrorMessage } from '@/lib/api/client';

export default function RecommendationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof getRecommendPlanDetail>>>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDayKey, setActiveDayKey] = useState('day1');
  const [isSavingMockPlan, setIsSavingMockPlan] = useState(false);
  const [hasAddedMockPlan, setHasAddedMockPlan] = useState(false);
  const headerBackSlot = <BackButton onPress={() => router.push('/recommend')} size={28} />;

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

  useEffect(() => {
    setIsSavingMockPlan(false);
    setHasAddedMockPlan(false);
  }, [plan?.id]);

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

  const isMockPlan = plan ? isMockRecommendPlanId(plan.id) : false;

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

  const handleAddMockPlan = async () => {
    if (!id || !isMockPlan || isSavingMockPlan || hasAddedMockPlan) {
      return;
    }

    try {
      setIsSavingMockPlan(true);
      await addMockRecommendTrip(id);
      setHasAddedMockPlan(true);
      Alert.alert('追加完了', 'おすすめプランをマイプランに追加しました。');
    } catch (error) {
      Alert.alert(
        '追加失敗',
        getApiErrorMessage(error, {
          fallback: 'おすすめプランの追加に失敗しました',
          unauthorized: 'ログイン状態を確認してください',
          forbidden: 'この操作を行う権限がありません',
          defaultWithStatus: true,
        })
      );
    } finally {
      setIsSavingMockPlan(false);
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
      headerLeftSlot={headerBackSlot}
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
        <View style={styles.actionWrap}>
          <Pressable
            style={[
              styles.actionButton,
              isMockPlan && (isSavingMockPlan || hasAddedMockPlan)
                ? styles.actionButtonGray
                : styles.actionButtonOrange,
            ]}
            onPress={isMockPlan ? () => void handleAddMockPlan() : () => void handleCustomize()}
            disabled={isMockPlan ? isSavingMockPlan || hasAddedMockPlan : false}
          >
            {isMockPlan ? (
              isSavingMockPlan ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <MaterialIcons name={hasAddedMockPlan ? 'check-circle' : 'playlist-add'} size={22} color="#FFFFFF" />
              )
            ) : (
              <MaterialIcons name="edit-note" size={22} color="#FFFFFF" />
            )}
            <Text style={styles.actionButtonText}>
              {isMockPlan
                ? isSavingMockPlan
                  ? '追加中...'
                  : hasAddedMockPlan
                    ? '追加済み'
                    : 'マイプランに追加'
                : 'プランをカスタマイズ'}
            </Text>
          </Pressable>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  actionWrap: {
    width: '100%',
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
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});
