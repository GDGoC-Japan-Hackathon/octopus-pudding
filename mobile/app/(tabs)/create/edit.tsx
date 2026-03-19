import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { weatherMock } from '@/data/travel';
import { getFriends } from '@/features/friends/api/get-friends';
import { type FriendResponse } from '@/features/friends/types/friend-request';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { travelStyles } from '@/features/travel/styles';
import { getTripDetail } from '@/features/trips/api/get-trip-detail';
import { addTripMember, removeTripMember } from '@/features/trips/api/trip-members';
import { updateTrip } from '@/features/trips/api/update-trip';
import { upsertTripPreference } from '@/features/trips/api/upsert-trip-preference';
import { type TripAtmosphere } from '@/features/trips/types/create-trip';
import {
  getTripEditErrorMessage,
  parsePreferenceBudget,
  validateAndBuildTripBasicPayload,
} from '@/features/trips/utils/edit-trip';
import { ApiError } from '@/lib/api/client';

const ATMOSPHERE_OPTIONS: TripAtmosphere[] = ['のんびり', 'アクティブ', '映え'];
const RECOMMEND_CATEGORY_OPTIONS = ['カフェ', '夜景', 'グルメ', '温泉'] as const;

function parseSelectedCategories(value?: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

type EditParams = {
  tripId?: string | string[];
};

function parseTripId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export default function TripEditScreen() {
  const router = useRouter();
  const { tripId: rawTripId } = useLocalSearchParams<EditParams>();
  const tripId = useMemo(() => parseTripId(rawTripId), [rawTripId]);

  const [isLoading, setIsLoading] = useState(true);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [participantCount, setParticipantCount] = useState('1');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [atmosphere, setAtmosphere] = useState<TripAtmosphere>('のんびり');
  const [budget, setBudget] = useState('');
  const [transportType, setTransportType] = useState('');

  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [currentMemberUserIds, setCurrentMemberUserIds] = useState<Set<number>>(new Set());
  const [selectedMemberUserIds, setSelectedMemberUserIds] = useState<Set<number>>(new Set());

  const [isSavingBasic, setIsSavingBasic] = useState(false);
  const [isSavingPreference, setIsSavingPreference] = useState(false);
  const [isSavingMembers, setIsSavingMembers] = useState(false);

  const refreshDetail = async (id: number) => {
    const detail = await getTripDetail(id);
    setOrigin(detail.trip.origin);
    setDestination(detail.trip.destination);
    setStartDate(detail.trip.start_date);
    setEndDate(detail.trip.end_date);
    setParticipantCount(String(detail.trip.participant_count ?? 1));
    setSelectedCategories(detail.trip.recommendation_categories ?? []);

    setAtmosphere(detail.preference?.atmosphere ?? 'のんびり');
    setBudget(detail.preference?.budget ? String(detail.preference.budget) : '');
    setTransportType(detail.preference?.transport_type ?? '');

    const memberIds = new Set(detail.members.map((member) => member.user_id));
    setCurrentMemberUserIds(memberIds);
    setSelectedMemberUserIds(new Set(memberIds));
  };

  const refreshFriends = async () => {
    try {
      setIsLoadingFriends(true);
      const list = await getFriends();
      setFriends(list);
    } catch (error) {
      Alert.alert('取得失敗', getTripEditErrorMessage(error, 'フレンド一覧の取得に失敗しました'));
      setFriends([]);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      if (!tripId) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        await Promise.all([refreshDetail(tripId), refreshFriends()]);
      } catch (error) {
        Alert.alert('取得失敗', getTripEditErrorMessage(error, 'プラン詳細の取得に失敗しました'));
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, [tripId]);

  const handleSaveBasic = async () => {
    if (!tripId || isSavingBasic) {
      return;
    }
    const result = validateAndBuildTripBasicPayload({
      origin,
      destination,
      startDate,
      endDate,
      participantCount,
    });
    if (!result.ok) {
      Alert.alert('入力エラー', result.message);
      return;
    }

    try {
      setIsSavingBasic(true);
      await updateTrip(tripId, {
        ...result.payload,
        recommendation_categories: selectedCategories,
      });
      await refreshDetail(tripId);
      Alert.alert('更新完了', '基本情報を更新しました。');
    } catch (error) {
      Alert.alert('更新失敗', getTripEditErrorMessage(error, '基本情報の更新に失敗しました'));
    } finally {
      setIsSavingBasic(false);
    }
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]
    );
  };

  const handleSavePreference = async () => {
    if (!tripId || isSavingPreference) {
      return;
    }

    const result = parsePreferenceBudget({
      budget,
      transportType,
    });
    if (!result.ok) {
      Alert.alert('入力エラー', result.message);
      return;
    }

    try {
      setIsSavingPreference(true);
      await upsertTripPreference(tripId, {
        atmosphere,
        budget: result.budget,
        transport_type: result.transportType,
      });
      await refreshDetail(tripId);
      Alert.alert('更新完了', '好みを更新しました。');
    } catch (error) {
      Alert.alert('更新失敗', getTripEditErrorMessage(error, '好みの更新に失敗しました'));
    } finally {
      setIsSavingPreference(false);
    }
  };

  const toggleMember = (userId: number) => {
    setSelectedMemberUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSaveMembers = async () => {
    if (!tripId || isSavingMembers) {
      return;
    }

    const toAdd = Array.from(selectedMemberUserIds).filter((userId) => !currentMemberUserIds.has(userId));
    const toRemove = Array.from(currentMemberUserIds).filter((userId) => !selectedMemberUserIds.has(userId));

    if (!toAdd.length && !toRemove.length) {
      Alert.alert('変更なし', '同行者の変更はありません。');
      return;
    }

    let hasError = false;

    try {
      setIsSavingMembers(true);

      for (const userId of toAdd) {
        try {
          await addTripMember(tripId, userId);
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) {
            continue;
          }
          hasError = true;
        }
      }

      for (const userId of toRemove) {
        try {
          await removeTripMember(tripId, userId);
        } catch {
          hasError = true;
        }
      }

      await refreshDetail(tripId);
      if (hasError) {
        Alert.alert('一部失敗', '一部の同行者更新に失敗しました。最新状態で再表示しています。');
      } else {
        Alert.alert('更新完了', '同行者を更新しました。');
      }
    } finally {
      setIsSavingMembers(false);
    }
  };

  if (!tripId) {
    return (
      <View style={travelStyles.screen}>
        <AppHeader title="編集" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
        <View style={travelStyles.container}>
          <Text style={travelStyles.heading}>tripId が指定されていません</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={travelStyles.screen}>
      <AppHeader title="プラン編集" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ ...travelStyles.container, paddingBottom: 24 }}>
        <BackButton
          onPress={() => {
            router.replace({
              pathname: '/plans/detail',
              params: { id: String(tripId) },
            });
          }}
        />

        {isLoading ? (
          <View style={travelStyles.detailSection}>
            <ActivityIndicator color="#F97316" />
            <Text style={travelStyles.sectionBody}>読み込み中...</Text>
          </View>
        ) : null}

        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.sectionTitleText}>基本情報</Text>
          <TextInput style={travelStyles.input} value={origin} onChangeText={setOrigin} placeholder="出発地" />
          <TextInput style={travelStyles.input} value={destination} onChangeText={setDestination} placeholder="目的地" />
          <TextInput style={travelStyles.input} value={startDate} onChangeText={setStartDate} placeholder="開始日 (YYYY-MM-DD)" />
          <TextInput style={travelStyles.input} value={endDate} onChangeText={setEndDate} placeholder="終了日 (YYYY-MM-DD)" />
          <TextInput style={travelStyles.input} value={participantCount} onChangeText={setParticipantCount} placeholder="人数" keyboardType="number-pad" />
          <Text style={travelStyles.sectionBody}>カテゴリ</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {RECOMMEND_CATEGORY_OPTIONS.map((option) => {
              const active = selectedCategories.includes(option);
              return (
                <Pressable
                  key={option}
                  style={[travelStyles.pillButton, active ? { borderColor: '#F97316', backgroundColor: '#FFF7ED' } : null]}
                  onPress={() => toggleCategory(option)}
                >
                  <Text style={[travelStyles.pillText, active ? { color: '#F97316' } : null]}>
                    {active ? '✓ ' : ''}
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={[travelStyles.primaryButton, isSavingBasic ? { opacity: 0.6 } : null]}
            onPress={handleSaveBasic}
            disabled={isSavingBasic}
          >
            {isSavingBasic ? <ActivityIndicator color="#FFFFFF" /> : <Text style={travelStyles.primaryButtonText}>基本情報を更新</Text>}
          </Pressable>
        </View>

        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.sectionTitleText}>好み</Text>
          <Text style={travelStyles.sectionBody}>雰囲気</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ATMOSPHERE_OPTIONS.map((option) => {
              const active = atmosphere === option;
              return (
                <Pressable
                  key={option}
                  style={[travelStyles.pillButton, active ? { borderColor: '#F97316', backgroundColor: '#FFF7ED' } : null]}
                  onPress={() => setAtmosphere(option)}
                >
                  <Text style={[travelStyles.pillText, active ? { color: '#F97316' } : null]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput style={travelStyles.input} value={budget} onChangeText={setBudget} placeholder="予算" keyboardType="number-pad" />
          <TextInput style={travelStyles.input} value={transportType} onChangeText={setTransportType} placeholder="移動手段 (例: train)" />
          <Pressable
            style={[travelStyles.primaryButton, isSavingPreference ? { opacity: 0.6 } : null]}
            onPress={handleSavePreference}
            disabled={isSavingPreference}
          >
            {isSavingPreference ? <ActivityIndicator color="#FFFFFF" /> : <Text style={travelStyles.primaryButtonText}>好みを更新</Text>}
          </Pressable>
        </View>

        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.sectionTitleText}>同行者</Text>
          <Text style={travelStyles.sectionBody}>
            フレンド一覧から同行者を選択してください（{selectedMemberUserIds.size}人選択中）
          </Text>
          {isLoadingFriends ? (
            <ActivityIndicator color="#F97316" />
          ) : friends.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {friends.map((friend) => {
                const active = selectedMemberUserIds.has(friend.user.id);
                return (
                  <Pressable
                    key={friend.user.id}
                    style={[travelStyles.pillButton, active ? { borderColor: '#F97316', backgroundColor: '#FFF7ED' } : null]}
                    onPress={() => toggleMember(friend.user.id)}
                  >
                    <Text style={[travelStyles.pillText, active ? { color: '#F97316' } : null]}>
                      {active ? '✓ ' : ''}
                      {friend.user.username}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={travelStyles.sectionBody}>フレンドがいません。先にフレンドを追加してください。</Text>
          )}
          <Pressable
            style={[travelStyles.primaryButton, isSavingMembers ? { opacity: 0.6 } : null]}
            onPress={handleSaveMembers}
            disabled={isSavingMembers}
          >
            {isSavingMembers ? <ActivityIndicator color="#FFFFFF" /> : <Text style={travelStyles.primaryButtonText}>同行者を更新</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
