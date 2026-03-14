import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { AppHeader } from '@/components/travel/AppHeader';
import { travelStyles } from '@/components/travel/styles';
import { createMethods, weatherMock } from '@/data/travel';

export default function CreateMethodScreen() {
  return (
    <View style={travelStyles.screen}>
      <AppHeader title="作成" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={travelStyles.container}>
        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.heading}>作成方法を選ぶ</Text>
          <Text style={travelStyles.sectionBody}>目的に合う方式で、旅のしおりを開始できます。</Text>
        </View>

        {createMethods.map((item) => (
          <Link key={item.id} href={{ pathname: `/${item.target}` }} asChild>
            <Pressable style={travelStyles.button}>
              <Text style={travelStyles.buttonTitle}>{item.title}</Text>
              <Text style={travelStyles.buttonDescription}>{item.description}</Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </View>
  );
}
