import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { weatherMock } from '@/data/travel';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { travelStyles } from '@/features/travel/styles';

const actionCards = [
  {
    key: 'new',
    title: '新しく旅を作る',
    description: '目的地や日程を入力して、新しい旅の計画を作成します。',
    buttonLabel: '作成する',
    icon: 'add-circle',
    imageUri:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCgKK_yESSSt8-0ZZ2E93dZgSlVbqE_YL3prHCXnrL1ZooN6tvXRjwSKxWrXxgAF9einTmY3FBzFFqTqXumd27d323mgSvZExwqXsXR7pWDtRIBZNPJjpytEiRA7uFaRsbDx5-3rqUR1mMxke-c1YQgwDz5dCdEVKAgke6rjcf1bqvFjE2hP8FYbQV_3vQXiE_La-MJ1sB0oBRJ7zcFGCvdfd8SY1vOCepOiZtrb_7G_-rAht1Z54OR9edHDsKHNV0Eo7GFmxsGFWO5',
    buttonVariant: 'primary' as const,
    onPressPath: '/create/new-plan',
  },
  {
    key: 'replan',
    title: 'トラブルで旅程を変更',
    description: '渋滞や天候の悪化など、旅のトラブルに遭遇したときに、旅程の変更を行います。',
    buttonLabel: '変更する',
    icon: 'warning',
    imageUri:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDpYEkA4IlOR0zPuvy_W0LJbxMe4baAL5_r64xSM10G1iHO0HabcYIrhiYCrmkHikNMKh5vDYH4O9N8d-21DzkIrA2G3APpd_yBDpftQWe8Als0yShelEWXyU2f7FAhY0lTnbgPqODY8O99W_Y1lQ0-cIgzgNBjjUxAWfY4tzHD-Bl_G63wYcTf7DZYEZUN9suhe_qkJHAmmJtuotqNRRJoFNC7tW3qhMLlpmCLx4DNeskDUMSIclE52K_JEEISpdV0t8Dzw-78RNQd',
    buttonVariant: 'secondary' as const,
    onPressPath: '/plans',
  },
] as const;

export default function CreateIndexScreen() {
  const router = useRouter();

  return (
    <ScrollView style={travelStyles.screen} contentContainerStyle={styles.contentContainer}>
      <AppHeader title="作成" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={travelStyles.container}>
        <View style={styles.heroBlock}>
          <Text style={styles.heroTitle}>ふた旅へようこそ</Text>
          <Text style={styles.heroDescription}>最高の思い出を一緒に作りましょう</Text>
        </View>

        {actionCards.map((card) => (
          <View key={card.key} style={styles.card}>
            <ImageBackground source={{ uri: card.imageUri }} style={styles.cardImage} imageStyle={styles.cardImageInner} />

            <View style={styles.cardBody}>
              <View style={styles.cardHeader}>
                <MaterialIcons
                  name={card.icon}
                  size={24}
                  color={card.key === 'new' ? '#EC5B13' : '#F59E0B'}
                />
                <Text style={styles.cardTitle}>{card.title}</Text>
              </View>

              <Text style={styles.cardDescription}>{card.description}</Text>



              <Pressable
                style={[
                  styles.cardButton,
                  card.buttonVariant === 'primary' ? styles.cardButtonPrimary : styles.cardButtonSecondary,
                ]}
                onPress={() => router.push(card.onPressPath)}
              >
                <Text
                  style={[
                    styles.cardButtonText,
                    card.buttonVariant === 'primary'
                      ? styles.cardButtonTextPrimary
                      : styles.cardButtonTextSecondary,
                  ]}
                >
                  {card.buttonLabel}
                </Text>
                <MaterialIcons
                  name={card.buttonVariant === 'primary' ? 'arrow-forward' : 'edit'}
                  size={18}
                  color={card.buttonVariant === 'primary' ? '#FFFFFF' : '#0F172A'}
                />
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingBottom: 24,
  },
  heroBlock: {
    gap: 6,
    marginBottom: 6,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFF1E8',
    borderWidth: 1,
    borderColor: '#FBD0B5',
    marginBottom: 4,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EC5B13',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
  },
  heroDescription: {
    fontSize: 15,
    color: '#64748B',
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#E5E7EB',
  },
  cardImageInner: {
    resizeMode: 'cover',
  },
  cardBody: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: '#64748B',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
  },
  cardButton: {
    minHeight: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  cardButtonPrimary: {
    backgroundColor: '#EC5B13',
  },
  cardButtonSecondary: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardButtonTextPrimary: {
    color: '#FFFFFF',
  },
  cardButtonTextSecondary: {
    color: '#0F172A',
  },
});
