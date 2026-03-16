import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { createItineraryItem } from '@/features/trips/api/create-itinerary-item';
import { createTripDay } from '@/features/trips/api/create-trip-day';
import { getTripDetail } from '@/features/trips/api/get-trip-detail';
import { updateTrip } from '@/features/trips/api/update-trip';
import { upsertTripPreference } from '@/features/trips/api/upsert-trip-preference';
import { type TripAtmosphere } from '@/features/trips/types/create-trip';
import { type TripAggregateResponse } from '@/features/trips/types/trip-edit';
import { travelStyles } from '@/features/travel/styles';
import { weatherMock } from '@/data/travel';
import { ApiError } from '@/lib/api/client';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ATMOSPHERE_OPTIONS: TripAtmosphere[] = ['のんびり', 'アクティブ', 'グルメ', '映え'];

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

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }
  if (error.status === 401) {
    return '認証期限が切れています。再ログイン後にお試しください。';
  }
  if (error.status === 403) {
    return 'このプランを編集する権限がありません。';
  }
  if (error.status === 404) {
    return '対象プランが見つかりませんでした。';
  }
  return `${fallback} (${error.status})`;
}

export default function TripEditScreen() {
  const { tripId: rawTripId } = useLocalSearchParams<EditParams>();
  const tripId = useMemo(() => parseTripId(rawTripId), [rawTripId]);

  const [aggregate, setAggregate] = useState<TripAggregateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [atmosphere, setAtmosphere] = useState<TripAtmosphere>('のんびり');
  const [companions, setCompanions] = useState('');
  const [budget, setBudget] = useState('');
  const [transportType, setTransportType] = useState('');

  const [newDayNumber, setNewDayNumber] = useState('1');
  const [newDayDate, setNewDayDate] = useState('');

  const [selectedDayId, setSelectedDayId] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemCost, setItemCost] = useState('');
  const [itemNotes, setItemNotes] = useState('');

  const [isSavingBasic, setIsSavingBasic] = useState(false);
  const [isSavingPreference, setIsSavingPreference] = useState(false);
  const [isAddingDay, setIsAddingDay] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);

  const refreshDetail = async (id: number) => {
    const detail = await getTripDetail(id);
    setAggregate(detail);

    setOrigin(detail.trip.origin);
    setDestination(detail.trip.destination);
    setStartDate(detail.trip.start_date);
    setEndDate(detail.trip.end_date);

    setAtmosphere(detail.preference?.atmosphere ?? 'のんびり');
    setCompanions(detail.preference?.companions ?? '');
    setBudget(detail.preference?.budget ? String(detail.preference.budget) : '');
    setTransportType(detail.preference?.transport_type ?? '');

    if (detail.days.length > 0) {
      const firstDayId = String(detail.days[0].id);
      setSelectedDayId((prev) => prev || firstDayId);
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
        await refreshDetail(tripId);
      } catch (error) {
        Alert.alert('取得失敗', getErrorMessage(error, 'プラン詳細の取得に失敗しました'));
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
    if (!origin.trim() || !destination.trim() || !startDate.trim() || !endDate.trim()) {
      Alert.alert('入力エラー', '出発地・目的地・出発日・終了日は必須です。');
      return;
    }
    if (!DATE_PATTERN.test(startDate.trim()) || !DATE_PATTERN.test(endDate.trim())) {
      Alert.alert('入力エラー', '日付は YYYY-MM-DD 形式で入力してください。');
      return;
    }

    try {
      setIsSavingBasic(true);
      await updateTrip(tripId, {
        origin: origin.trim(),
        destination: destination.trim(),
        start_date: startDate.trim(),
        end_date: endDate.trim(),
      });
      await refreshDetail(tripId);
      Alert.alert('更新完了', '基本情報を更新しました。');
    } catch (error) {
      Alert.alert('更新失敗', getErrorMessage(error, '基本情報の更新に失敗しました'));
    } finally {
      setIsSavingBasic(false);
    }
  };

  const handleSavePreference = async () => {
    if (!tripId || isSavingPreference) {
      return;
    }

    let parsedBudget: number | undefined;
    if (budget.trim()) {
      const value = Number(budget.trim());
      if (!Number.isInteger(value) || value <= 0) {
        Alert.alert('入力エラー', '予算は正の整数で入力してください。');
        return;
      }
      parsedBudget = value;
    }

    try {
      setIsSavingPreference(true);
      await upsertTripPreference(tripId, {
        atmosphere,
        companions: companions.trim() || undefined,
        budget: parsedBudget,
        transport_type: transportType.trim() || undefined,
      });
      await refreshDetail(tripId);
      Alert.alert('更新完了', '好みを更新しました。');
    } catch (error) {
      Alert.alert('更新失敗', getErrorMessage(error, '好みの更新に失敗しました'));
    } finally {
      setIsSavingPreference(false);
    }
  };

  const handleAddDay = async () => {
    if (!tripId || isAddingDay) {
      return;
    }

    const dayNumber = Number(newDayNumber.trim());
    if (!Number.isInteger(dayNumber) || dayNumber <= 0) {
      Alert.alert('入力エラー', '日目は1以上の整数で入力してください。');
      return;
    }
    if (newDayDate.trim() && !DATE_PATTERN.test(newDayDate.trim())) {
      Alert.alert('入力エラー', '日付は YYYY-MM-DD 形式で入力してください。');
      return;
    }

    try {
      setIsAddingDay(true);
      const created = await createTripDay(tripId, {
        day_number: dayNumber,
        date: newDayDate.trim() || undefined,
      });
      await refreshDetail(tripId);
      setSelectedDayId(String(created.id));
      setNewDayDate('');
      Alert.alert('追加完了', '日程を追加しました。');
    } catch (error) {
      Alert.alert('追加失敗', getErrorMessage(error, '日程の追加に失敗しました'));
    } finally {
      setIsAddingDay(false);
    }
  };

  const handleAddItem = async () => {
    if (!tripId || isAddingItem) {
      return;
    }

    const dayId = Number(selectedDayId);
    if (!Number.isInteger(dayId) || dayId <= 0) {
      Alert.alert('入力エラー', '先に追加先の日程を選択してください。');
      return;
    }
    if (!itemName.trim()) {
      Alert.alert('入力エラー', '行程名は必須です。');
      return;
    }

    let parsedCost: number | undefined;
    if (itemCost.trim()) {
      const value = Number(itemCost.trim());
      if (!Number.isInteger(value) || value < 0) {
        Alert.alert('入力エラー', '想定費用は0以上の整数で入力してください。');
        return;
      }
      parsedCost = value;
    }

    try {
      setIsAddingItem(true);
      await createItineraryItem(tripId, dayId, {
        name: itemName.trim(),
        category: itemCategory.trim() || undefined,
        estimated_cost: parsedCost,
        notes: itemNotes.trim() || undefined,
      });
      await refreshDetail(tripId);
      setItemName('');
      setItemCategory('');
      setItemCost('');
      setItemNotes('');
      Alert.alert('追加完了', '行程を追加しました。');
    } catch (error) {
      Alert.alert('追加失敗', getErrorMessage(error, '行程の追加に失敗しました'));
    } finally {
      setIsAddingItem(false);
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
        <BackButton />

        {isLoading ? (
          <View style={travelStyles.detailSection}>
            <ActivityIndicator color="#F97316" />
            <Text style={travelStyles.sectionBody}>読み込み中...</Text>
          </View>
        ) : null}

        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.sectionTitleText}>基本情報（PATCH /trips/{tripId}）</Text>
          <TextInput style={travelStyles.input} value={origin} onChangeText={setOrigin} placeholder="出発地" />
          <TextInput style={travelStyles.input} value={destination} onChangeText={setDestination} placeholder="目的地" />
          <TextInput style={travelStyles.input} value={startDate} onChangeText={setStartDate} placeholder="開始日 (YYYY-MM-DD)" />
          <TextInput style={travelStyles.input} value={endDate} onChangeText={setEndDate} placeholder="終了日 (YYYY-MM-DD)" />
          <Pressable
            style={[travelStyles.primaryButton, isSavingBasic ? { opacity: 0.6 } : null]}
            onPress={handleSaveBasic}
            disabled={isSavingBasic}
          >
            {isSavingBasic ? <ActivityIndicator color="#FFFFFF" /> : <Text style={travelStyles.primaryButtonText}>基本情報を更新</Text>}
          </Pressable>
        </View>

        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.sectionTitleText}>好み（PUT /trips/{tripId}/preference）</Text>
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
          <TextInput style={travelStyles.input} value={companions} onChangeText={setCompanions} placeholder="同行者 (例: friends)" />
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
          <Text style={travelStyles.sectionTitleText}>日程追加（POST /trips/{tripId}/days）</Text>
          <TextInput
            style={travelStyles.input}
            value={newDayNumber}
            onChangeText={setNewDayNumber}
            placeholder="日目 (例: 1)"
            keyboardType="number-pad"
          />
          <TextInput
            style={travelStyles.input}
            value={newDayDate}
            onChangeText={setNewDayDate}
            placeholder="日付 (YYYY-MM-DD, 任意)"
          />
          <Pressable
            style={[travelStyles.primaryButton, isAddingDay ? { opacity: 0.6 } : null]}
            onPress={handleAddDay}
            disabled={isAddingDay}
          >
            {isAddingDay ? <ActivityIndicator color="#FFFFFF" /> : <Text style={travelStyles.primaryButtonText}>日程を追加</Text>}
          </Pressable>

          <Text style={[travelStyles.sectionBody, { fontWeight: '700' }]}>登録済み日程</Text>
          {aggregate?.days.length ? (
            aggregate.days.map((day) => {
              const selected = selectedDayId === String(day.id);
              return (
                <Pressable
                  key={day.id}
                  style={[travelStyles.button, selected ? { borderColor: '#F97316', backgroundColor: '#FFF7ED' } : null]}
                  onPress={() => setSelectedDayId(String(day.id))}
                >
                  <Text style={travelStyles.buttonTitle}>Day {day.day_number}</Text>
                  <Text style={travelStyles.buttonDescription}>{day.date ?? '日付未設定'} / ID: {day.id}</Text>
                </Pressable>
              );
            })
          ) : (
            <Text style={travelStyles.sectionBody}>まだ日程はありません。</Text>
          )}
        </View>

        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.sectionTitleText}>行程追加（POST /trips/{tripId}/days/{'{dayId}'}/items）</Text>
          <Text style={travelStyles.sectionBody}>追加先Day ID: {selectedDayId || '未選択'}</Text>
          <TextInput style={travelStyles.input} value={itemName} onChangeText={setItemName} placeholder="行程名 (例: 清水寺)" />
          <TextInput style={travelStyles.input} value={itemCategory} onChangeText={setItemCategory} placeholder="カテゴリ (例: sightseeing)" />
          <TextInput style={travelStyles.input} value={itemCost} onChangeText={setItemCost} placeholder="想定費用" keyboardType="number-pad" />
          <TextInput style={travelStyles.input} value={itemNotes} onChangeText={setItemNotes} placeholder="メモ" multiline />
          <Pressable
            style={[travelStyles.primaryButton, isAddingItem ? { opacity: 0.6 } : null]}
            onPress={handleAddItem}
            disabled={isAddingItem}
          >
            {isAddingItem ? <ActivityIndicator color="#FFFFFF" /> : <Text style={travelStyles.primaryButtonText}>行程を追加</Text>}
          </Pressable>

          <Text style={[travelStyles.sectionBody, { fontWeight: '700' }]}>登録済み行程</Text>
          {aggregate?.itinerary_items.length ? (
            aggregate.itinerary_items.map((item) => (
              <View key={item.id} style={travelStyles.button}>
                <Text style={travelStyles.buttonTitle}>{item.name}</Text>
                <Text style={travelStyles.buttonDescription}>
                  DayID: {item.trip_day_id} / {item.category ?? 'category未設定'} / {item.estimated_cost ?? 0}円
                </Text>
              </View>
            ))
          ) : (
            <Text style={travelStyles.sectionBody}>まだ行程はありません。</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
