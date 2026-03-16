import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { getTripDetail } from '@/features/trips/api/get-trip-detail';
import { updateTrip } from '@/features/trips/api/update-trip';
import { upsertTripPreference } from '@/features/trips/api/upsert-trip-preference';
import { type TripAtmosphere } from '@/features/trips/types/create-trip';
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

  const [isLoading, setIsLoading] = useState(true);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [atmosphere, setAtmosphere] = useState<TripAtmosphere>('のんびり');
  const [companions, setCompanions] = useState('');
  const [budget, setBudget] = useState('');
  const [transportType, setTransportType] = useState('');

  const [isSavingBasic, setIsSavingBasic] = useState(false);
  const [isSavingPreference, setIsSavingPreference] = useState(false);

  const refreshDetail = async (id: number) => {
    const detail = await getTripDetail(id);
    setOrigin(detail.trip.origin);
    setDestination(detail.trip.destination);
    setStartDate(detail.trip.start_date);
    setEndDate(detail.trip.end_date);

    setAtmosphere(detail.preference?.atmosphere ?? 'のんびり');
    setCompanions(detail.preference?.companions ?? '');
    setBudget(detail.preference?.budget ? String(detail.preference.budget) : '');
    setTransportType(detail.preference?.transport_type ?? '');
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
          <Text style={travelStyles.sectionTitleText}>基本情報</Text>
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
      </ScrollView>
    </View>
  );
}
