import { MaterialIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/travel/AppHeader';
import { recommendedPlans, weatherMock } from '@/data/travel';

const categories = ['すべて', 'カフェ', '夜景', 'グルメ', '温泉'];

export default function RecommendationListScreen() {
  return (
    <View style={styles.screen}>
      <AppHeader title="おすすめ" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryContent}>
          {categories.map((category, index) => (
            <Pressable key={category} style={styles.categoryTab}>
              <Text style={[styles.categoryText, index === 0 ? styles.categoryTextActive : null]}>{category}</Text>
              <View style={[styles.categoryUnderline, index === 0 ? styles.categoryUnderlineActive : null]} />
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {recommendedPlans.map((plan) => (
          <Link key={plan.id} href={{ pathname: '/recommend/detail', params: { id: plan.id } }} asChild>
            <Pressable style={styles.card}>
              <View style={styles.imageWrap}>
                <Image source={{ uri: plan.image }} style={styles.image} />
                <View style={styles.locationTag}>
                  <Text style={styles.locationTagText}>{plan.location}</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{plan.title}</Text>
                  <MaterialIcons name="more-vert" size={20} color="#94A3B8" />
                </View>

                <View style={styles.authorRow}>
                  <View style={styles.avatar}>
                    <MaterialIcons name="person" size={16} color="#EC5B13" />
                  </View>
                  <View style={styles.authorCopy}>
                    <Text style={styles.authorName}>{plan.author}</Text>
                  </View>
                  <View style={styles.likeRow}>
                    <MaterialIcons name="favorite" size={20} color="#EC5B13" />
                    <Text style={styles.likeText}>{plan.likes.toLocaleString()}</Text>
                  </View>
                </View>

                <View style={styles.detailButton}>
                  <Text style={styles.detailButtonText}>詳細を見る</Text>
                </View>
              </View>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8F6F6',
  },
  categoryBar: {
    backgroundColor: '#F8F6F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  categoryContent: {
    paddingHorizontal: 16,
    gap: 24,
  },
  categoryTab: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 10,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryTextActive: {
    color: '#EC5B13',
    fontWeight: '800',
  },
  categoryUnderline: {
    marginTop: 10,
    height: 2,
    width: '100%',
    backgroundColor: 'transparent',
  },
  categoryUnderlineActive: {
    backgroundColor: '#EC5B13',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 24,
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#E2E8F0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  locationTag: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  locationTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EC5B13',
  },
  cardBody: {
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: '#0F172A',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(236, 91, 19, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorCopy: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  detailButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#EC5B13',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
