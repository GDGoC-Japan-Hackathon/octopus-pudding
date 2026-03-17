import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { weatherMock } from '@/data/travel';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { travelStyles } from '@/features/travel/styles';
import { createTrip } from '@/features/trips/api/create-trip';
import {
  type CreateTripFormValues,
  validateAndBuildCreateTripPayload,
} from '@/features/trips/utils/create-trip';

const formItems = [
  {
    key: 'origin',
    label: '出発地',
    placeholder: '例: 東京',
  },
  {
    key: 'destination',
    label: '目的地',
    placeholder: '例: 札幌',
  },
  {
    key: 'startDate',
    label: '出発日',
    placeholder: '例: 2026-04-01',
  },
  {
    key: 'endDate',
    label: '終了日',
    placeholder: '例: 2026-04-03',
  },
  {
    key: 'participantCount',
    label: '人数',
    placeholder: '例: 4',
  },
  {
    key: 'budget',
    label: '予算（任意）',
    placeholder: '例: 120000',
  },
] as const;

export default function PlanCreateScreen() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fields, setFields] = useState<CreateTripFormValues>({
    origin: '',
    destination: '',
    startDate: '',
    endDate: '',
    participantCount: '1',
    budget: '',
  });

  const updateField = (key: (typeof formItems)[number]['key'], value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const result = validateAndBuildCreateTripPayload(fields);
    if (!result.ok) {
      Alert.alert('入力エラー', result.message);
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await createTrip(result.payload);
      Alert.alert('保存完了', '新規プランを作成しました。');
      router.replace({
        pathname: '/plans/detail',
        params: { id: String(created.trip.id) },
      });
    } catch {
      Alert.alert('作成失敗', 'プラン作成に失敗しました。ログイン状態やAPI接続を確認してください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={travelStyles.screen} contentContainerStyle={{ paddingBottom: 24 }}>
      <AppHeader title="新規プラン作成" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={travelStyles.container}>
        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.heading}>基本情報を入力</Text>
          <Text style={travelStyles.sectionBody}>
            下記を入力すると、バックエンドAPI経由でプランが作成されます。
          </Text>
        </View>

        {formItems.map((item) => (
          <View key={item.key}>
            <Text style={[travelStyles.sectionBody, { fontWeight: '700' }]}>{item.label}</Text>
            <TextInput
              style={travelStyles.input}
              value={fields[item.key]}
              onChangeText={(value) => updateField(item.key, value)}
              placeholder={item.placeholder}
              placeholderTextColor="#94A3B8"
              keyboardType={item.key === 'budget' || item.key === 'participantCount' ? 'numeric' : 'default'}
              autoCapitalize="none"
            />
          </View>
        ))}

        <Pressable
          style={[travelStyles.primaryButton, isSubmitting ? { opacity: 0.6 } : null]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={travelStyles.primaryButtonText}>プランを保存して詳細を見る</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
