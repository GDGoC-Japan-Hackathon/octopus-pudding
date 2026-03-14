import { Link } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';

import { AppHeader } from '@/components/travel/AppHeader';
import { SummaryCard } from '@/components/travel/SummaryCard';
import { travelStyles } from '@/components/travel/styles';
import { savedPlans, weatherMock } from '@/data/travel';

export default function PlansListScreen() {
  return (
    <View style={travelStyles.screen}>
      <AppHeader title="作成済みの計画" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={travelStyles.container}>
        <FlatList
          data={savedPlans}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Link
              href={{ pathname: '/plans/detail', params: { id: item.id } }}
              asChild
            >
              <Pressable>
                <SummaryCard
                  item={{
                    id: item.id,
                    title: item.title,
                    period: item.period,
                    route: item.route,
                    days: item.days,
                    budget: item.budget,
                    image: item.image,
                    status: item.status,
                  }}
                />
              </Pressable>
            </Link>
          )}
          ItemSeparatorComponent={() => <View />}
          scrollEnabled={false}
        />
      </View>
    </View>
  );
}
