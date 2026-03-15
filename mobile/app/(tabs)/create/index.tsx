import { MaterialIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/travel/AppHeader';
import { createMethods, weatherMock } from '@/data/travel';

const cardImages = {
  'create-new':
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCgKK_yESSSt8-0ZZ2E93dZgSlVbqE_YL3prHCXnrL1ZooN6tvXRjwSKxWrXxgAF9einTmY3FBzFFqTqXumd27d323mgSvZExwqXsXR7pWDtRIBZNPJjpytEiRA7uFaRsbDx5-3rqUR1mMxke-c1YQgwDz5dCdEVKAgke6rjcf1bqvFjE2hP8FYbQV_3vQXiE_La-MJ1sB0oBRJ7zcFGCvdfd8SY1vOCepOiZtrb_7G_-rAht1Z54OR9edHDsKHNV0Eo7GFmxsGFWO5',
  'create-replan':
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDpYEkA4IlOR0zPuvy_W0LJbxMe4baAL5_r64xSM10G1iHO0HabcYIrhiYCrmkHikNMKh5vDYH4O9N8d-21DzkIrA2G3APpd_yBDpftQWe8Als0yShelEWXyU2f7FAhY0lTnbgPqODY8O99W_Y1lQ0-cIgzgNBjjUxAWfY4tzHD-Bl_G63wYcTf7DZYEZUN9suhe_qkJHAmmJtuotqNRRJoFNC7tW3qhMLlpmCLx4DNeskDUMSIclE52K_JEEISpdV0t8Dzw-78RNQd',
} as const;

export default function CreateMethodScreen() {
  return (
    <View style={styles.screen}>
      <AppHeader title="作成" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>ふた旅へようこそ</Text>
          <Text style={styles.heroBody}>最高の思い出を一緒に作りましょう</Text>
        </View>

        {createMethods.map((item) => {
          const isPrimary = item.id === 'create-new';
          const iconName = isPrimary ? 'add-circle' : 'warning-amber';
          const buttonLabel = isPrimary ? '作成する' : '変更する';
          const buttonIcon = isPrimary ? 'arrow-forward' : 'edit';

          return (
            <View key={item.id} style={styles.card}>
              <Image source={{ uri: cardImages[item.id] }} style={styles.cardImage} />

              <View style={styles.cardBody}>
                <View style={styles.cardCopy}>
                  <View style={styles.cardTitleRow}>
                    <MaterialIcons name={iconName} size={24} color={isPrimary ? '#EC5B13' : '#F59E0B'} />
                    <Text style={styles.cardTitle}>{isPrimary ? '新しく旅を作る' : 'トラブルで旅程を変更'}</Text>
                  </View>
                  <Text style={styles.cardDescription}>
                    {isPrimary
                      ? '新しい旅の計画をここから始めましょう。目的地、日程、同行者を決めて出発！'
                      : '急な予定変更やトラブルにも柔軟に対応。現在の旅程を素早く調整します。'}
                  </Text>
                </View>

                <Link href={{ pathname: `/${item.target}` }} asChild>
                  <Pressable style={[styles.actionButton, isPrimary ? styles.primaryButton : styles.secondaryButton]}>
                    <Text style={[styles.actionButtonText, isPrimary ? styles.primaryButtonText : styles.secondaryButtonText]}>
                      {buttonLabel}
                    </Text>
                    <MaterialIcons
                      name={buttonIcon}
                      size={18}
                      color={isPrimary ? '#FFFFFF' : '#0F172A'}
                    />
                  </Pressable>
                </Link>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F6F6',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 28,
    gap: 24,
  },
  hero: {
    gap: 8,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#0F172A',
  },
  heroBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
  },
  card: {
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#E5E7EB',
  },
  cardBody: {
    padding: 20,
    gap: 18,
  },
  cardCopy: {
    gap: 10,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardDescription: {
    fontSize: 15,
    lineHeight: 24,
    color: '#64748B',
  },
  actionButton: {
    minHeight: 54,
    borderRadius: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#EC5B13',
    shadowColor: '#EC5B13',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  secondaryButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#0F172A',
  },
});
