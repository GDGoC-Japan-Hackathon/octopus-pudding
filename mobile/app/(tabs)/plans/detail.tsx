import { useLocalSearchParams } from 'expo-router';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import { AppHeader } from '@/components/travel/AppHeader';
import { travelStyles } from '@/components/travel/styles';
import { savedPlans, weatherMock } from '@/data/travel';

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const plan = savedPlans.find((item) => item.id === id);

  if (!plan) {
    return (
      <View style={travelStyles.screen}>
        <AppHeader title="作成済みの計画" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
        <View style={travelStyles.container}>
          <Text style={[travelStyles.heading, travelStyles.accentText]}>計画が見つかりませんでした</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={travelStyles.screen} contentContainerStyle={{ paddingBottom: 24 }}>
      <AppHeader title="計画詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={travelStyles.container}>
        <Image source={{ uri: plan.image }} style={{ width: '100%', height: 180, borderRadius: 16 }} />

        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.heading}>{plan.title}</Text>
          <Text style={travelStyles.sectionBody}>開始日: {plan.startDate}</Text>
          <Text style={travelStyles.sectionBody}>日数: {plan.days}日</Text>
          <Text style={travelStyles.sectionBody}>予算: ¥{plan.budget.toLocaleString()}</Text>
          <Text style={travelStyles.sectionBody}>ルート: {plan.route}</Text>
          <Text style={travelStyles.sectionBody}>人数: {plan.people}</Text>
        </View>

        <View style={travelStyles.card}>
          <Text style={travelStyles.sectionTitleText}>ハイライト</Text>
          {plan.highlights.map((item) => (
            <Text key={item} style={travelStyles.sectionBody}>
              • {item}
            </Text>
          ))}
        </View>

        <Pressable style={travelStyles.primaryButton}>
          <Text style={travelStyles.primaryButtonText}>この計画を編集する</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
