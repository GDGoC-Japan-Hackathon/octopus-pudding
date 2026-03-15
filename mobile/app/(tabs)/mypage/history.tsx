import { FlatList, View } from 'react-native';

import { AppHeader } from '@/components/travel/AppHeader';
import { ListButton } from '@/components/travel/ListButton';
import { travelStyles } from '@/components/travel/styles';
import { tripHistoryMock, weatherMock } from '@/data/travel';

export default function HistoryListScreen() {
  return (
    <View style={travelStyles.screen}>
      <AppHeader title="旅行履歴" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
      <View style={travelStyles.container}>
        <FlatList
          data={tripHistoryMock}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListButton
              title={item.title}
              description={`${item.date} / ${item.detail}`}
              href={{
                pathname: '/mypage/detail',
                params: { section: 'history', id: item.id },
              }}
            />
          )}
          ItemSeparatorComponent={() => null}
        />
      </View>
    </View>
  );
}
