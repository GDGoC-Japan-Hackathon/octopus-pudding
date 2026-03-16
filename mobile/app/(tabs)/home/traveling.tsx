import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AppHeader } from '@/features/travel/components/AppHeader';
import { PhotoCard } from '@/features/travel/components/PhotoCard';
import { travelStyles } from '@/features/travel/styles';
import {
  recommendedPlans,
  timelineMock,
  weatherMock,
} from '@/data/travel';

export default function HomeTravelingScreen() {
  const itineraryNow = timelineMock[0];
  const itineraryNext = timelineMock[1];

  return (
    <ScrollView style={travelStyles.screen}>
      <AppHeader title="ホーム" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={travelStyles.container}>
        <View style={travelStyles.sectionTitle}>
          <Text style={travelStyles.sectionTitleText}>旅行中</Text>
        </View>

        <View style={travelStyles.timelineCard}>
          <Text style={travelStyles.subheading}>現在の行程</Text>
          <View style={travelStyles.timelineRow}>
            <Text style={travelStyles.timelineTime}>{itineraryNow.time}</Text>
            <Text style={travelStyles.timelineText}>{itineraryNow.place}</Text>
          </View>
          <Text style={travelStyles.subheading}>{itineraryNow.memo}</Text>

          <View style={travelStyles.divider} />

          <View style={travelStyles.timelineRow}>
            <Text style={[travelStyles.timelineTime, { backgroundColor: '#F97316' }]}> {itineraryNext.time}</Text>
            <Text style={travelStyles.timelineText}>{itineraryNext.place}</Text>
          </View>
          <Text style={travelStyles.subheading}>{itineraryNext.memo}</Text>
        </View>

        <View style={travelStyles.horizontalSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 4 }}
          >
            {recommendedPlans.slice(0, 3).map((item) => (
              <Link
                key={item.id}
                href={{ pathname: '/recommend/detail', params: { id: item.id } }}
                asChild
              >
                <Pressable>
                  <PhotoCard
                    item={{
                      id: item.id,
                      title: item.title,
                      location: item.location,
                      image: item.image,
                      author: item.author,
                      likes: item.likes,
                    }}
                  />
                </Pressable>
              </Link>
            ))}
          </ScrollView>
        </View>
      </View>
    </ScrollView>
  );
}
