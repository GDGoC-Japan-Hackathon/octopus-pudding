import { useLocalSearchParams } from 'expo-router';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import { AppHeader } from '@/components/travel/AppHeader';
import { travelStyles } from '@/components/travel/styles';
import { recommendedPlans, timelineMock, weatherMock } from '@/data/travel';

export default function RecommendationDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const plan = recommendedPlans.find((item) => item.id === id);

  if (!plan) {
    return (
      <View style={travelStyles.screen}>
        <AppHeader title="おすすめ" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
        <View style={travelStyles.container}>
          <Text style={[travelStyles.heading, travelStyles.accentText]}>投稿が見つかりませんでした</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={travelStyles.screen} contentContainerStyle={{ paddingBottom: 24 }}>
      <AppHeader title="おすすめ詳細" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={travelStyles.container}>
        <Image source={{ uri: plan.image }} style={{ width: '100%', height: 210, borderRadius: 16 }} />

        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.heading}>{plan.title}</Text>
          <Text style={travelStyles.sectionBody}>カテゴリ: {plan.category}</Text>
          <Text style={travelStyles.sectionBody}>投稿者: {plan.author}</Text>
          <Text style={travelStyles.sectionBody}>想定時間: 3時間30分</Text>
          <Text style={travelStyles.sectionBody}>場所: {plan.location}</Text>
        </View>

        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.sectionTitleText}>行程イメージ</Text>
          {timelineMock.slice(0, 2).map((point) => (
            <View key={point.id} style={travelStyles.timelineRow}>
              <Text style={travelStyles.timelineTime}>{point.time}</Text>
              <View>
                <Text style={travelStyles.timelineText}>{point.place}</Text>
                <Text style={travelStyles.subheading}>{point.memo}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable style={travelStyles.primaryButton}>
          <Text style={travelStyles.primaryButtonText}>このプランを作成画面へ</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
