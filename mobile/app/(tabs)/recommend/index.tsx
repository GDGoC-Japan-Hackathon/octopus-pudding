import { Link } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';

import { AppHeader } from '@/features/travel/components/AppHeader';
import { PhotoCard } from '@/features/travel/components/PhotoCard';
import { travelStyles } from '@/features/travel/styles';
import { recommendedPlans, weatherMock } from '@/data/travel';

export default function RecommendationListScreen() {
  return (
    <View style={travelStyles.screen}>
      <AppHeader title="おすすめ" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={travelStyles.container}>
        <FlatList
          data={recommendedPlans}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <Link
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
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      </View>
    </View>
  );
}
