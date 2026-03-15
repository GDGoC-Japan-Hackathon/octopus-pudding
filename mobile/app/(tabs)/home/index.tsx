import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AppHeader } from '@/features/travel/components/AppHeader';
import { PhotoCard } from '@/features/travel/components/PhotoCard';
import { travelStyles } from '@/features/travel/styles';
import {
  recommendedPlans,
  weatherMock,
} from '@/data/travel';

export default function HomeNotTravelingScreen() {
  return (
    <ScrollView style={travelStyles.screen}>
      <AppHeader title="ホーム" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={travelStyles.container}>
        <View style={travelStyles.sectionTitle}>
          <Text style={travelStyles.sectionTitleText}>旅行していない</Text>
          <Text style={travelStyles.subheading}>ホーム画面トップ</Text>
        </View>

        <View style={travelStyles.sectionTitle}>
          <Text style={travelStyles.sectionTitleText}>開始前の提案</Text>
          <Text style={travelStyles.subheading}>現在地（{weatherMock.location}）で使えるおすすめです</Text>
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

        <Link href="/home/traveling" asChild>
          <Pressable style={travelStyles.primaryButton}>
            <Text style={travelStyles.primaryButtonText}>旅行中画面を開く</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}
