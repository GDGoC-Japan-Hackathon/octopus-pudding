import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/travel/AppHeader';
import { travelStyles } from '@/components/travel/styles';
import { weatherMock } from '@/data/travel';
import { createTrip } from '@/features/trips/api/create-trip';

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
    key: 'budget',
    label: '予算（任意）',
    placeholder: '例: 120000',
  },
] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function PlanCreateScreen() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fields, setFields] = useState({
    origin: '',
    destination: '',
    startDate: '',
    endDate: '',
    budget: '',
  });

  const updateField = (key: (typeof formItems)[number]['key'], value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const origin = fields.origin.trim();
    const destination = fields.destination.trim();
    const startDate = fields.startDate.trim();
    const endDate = fields.endDate.trim();
    const budgetText = fields.budget.trim();

    if (!origin || !destination || !startDate || !endDate) {
      Alert.alert('入力エラー', '出発地・目的地・出発日・終了日は必須です。');
      return;
    }

    if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) {
      Alert.alert('入力エラー', '日付は YYYY-MM-DD 形式で入力してください。');
      return;
    }

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      Alert.alert('入力エラー', '終了日は出発日以降の日付を入力してください。');
      return;
    }

    let budget: number | undefined;
    if (budgetText) {
      const parsedBudget = Number(budgetText);
      if (!Number.isInteger(parsedBudget) || parsedBudget <= 0) {
        Alert.alert('入力エラー', '予算は正の整数で入力してください。');
        return;
      }
      budget = parsedBudget;
    }

    try {
      setIsSubmitting(true);
      await createTrip({
        origin,
        destination,
        start_date: startDate,
        end_date: endDate,
        status: 'planned',
        preference: budget
          ? {
              atmosphere: 'のんびり',
              budget,
            }
          : undefined,
      });
      Alert.alert('保存完了', '新規プランを作成しました。');
      router.replace('/(tabs)/plans');
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
              keyboardType={item.key === 'budget' ? 'numeric' : 'default'}
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
            <Text style={travelStyles.primaryButtonText}>下書きを保存して編集へ進む</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
