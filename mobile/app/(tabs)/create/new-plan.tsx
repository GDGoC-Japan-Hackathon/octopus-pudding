import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/travel/AppHeader';
import { travelStyles } from '@/components/travel/styles';
import { weatherMock } from '@/data/travel';

const formItems = [
  { key: 'title', label: 'タイトル', placeholder: '例: 札幌で雪景色を楽しむ' },
  { key: 'days', label: '日数', placeholder: '例: 2' },
  { key: 'budget', label: '予算（円）', placeholder: '例: 120000' },
  { key: 'start', label: '出発日', placeholder: '例: 2026/04/01' },
];

export default function PlanCreateScreen() {
  const [fields, setFields] = useState<Record<string, string>>({
    title: '',
    days: '',
    budget: '',
    start: '',
  });

  return (
    <ScrollView style={travelStyles.screen} contentContainerStyle={{ paddingBottom: 24 }}>
      <AppHeader title="新規プラン作成" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={travelStyles.container}>
        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.heading}>基本情報を入力</Text>
          <Text style={travelStyles.sectionBody}>下記を入力すると、最初の仮プランが作成されます。</Text>
        </View>

        {formItems.map((item) => (
          <View key={item.key}>
            <Text style={[travelStyles.sectionBody, { fontWeight: '700' }]}>{item.label}</Text>
            <TextInput
              style={travelStyles.input}
              value={fields[item.key]}
              onChangeText={(value) => setFields({ ...fields, [item.key]: value })}
              placeholder={item.placeholder}
              placeholderTextColor="#94A3B8"
            />
          </View>
        ))}

        <Pressable style={travelStyles.primaryButton}>
          <Text style={travelStyles.primaryButtonText}>下書きを保存して編集へ進む</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
