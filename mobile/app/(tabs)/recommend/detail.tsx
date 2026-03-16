import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/travel/AppHeader';
import { recommendedPlans, timelineMock, weatherMock } from '@/data/travel';

const profileImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA_SqaUfw8zu_QnwPs_CKI13rm3gTKTSGeYC36Sn2MBqAaa57SvDR6OtqW3XV8VxQoSt6BKTnVtkE3sah-IJrW6areRY2yHLewpxm82PQ88tY9CTP9BDR1lc80sx6TtjAq34-EERc5JXGTDcKGfkbUdhWx4iPkW-qWMU0TcubFy_il6vRnEFvjWlU3qwFKCqifOYSZ-PozufU1F9o1vxpsklfWPicYSre_pX8hdgVsDB8VHBcty-USY2MOVIPxVIrs6_rKimx1g8Q9n';
const mapImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDKPfmAquZ3l01KA2Q_NwK6pGvUrxKXDjpbOI3p0bBiy_rWRq4uHgXM2AA5Z9KbXTJsLIzvOqhl1jL7vkwt4bM7PkT6icPqvovbDX6TVfzw6EINesLiBmHM5rfQLuN67_nvlKfL-cUGtKpE62QAw_Bf80W2PykqdNA_qWhKg1UUO_N3aUGSXbKZNXP5NlyyeedIM81CgV31umy05iFpMD_WBYnk_ocnxd6LOHP2ou-hcfkmYIGV1L_x6V5mM4PPrW_p3eK8JEoG-QsO';
const cafeImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC5fxSL-urojsflocnBfnLIi91TXNCqK1LhC8zbOnO9Pmwg7wCYcaE9C7wfZKHuEclE0PoeqFoMqizzzNe7o269WPu9Ni1UtE9Kg-S8agq_eXLddFFlf7DabwTe75b7nIP26wjSNPH1PLfQaTeHOgBrogkPhW4jHcbCKmJsznyxE-GTeGFv7e4_qbiwdZe-Blz__Kkz3QNNYr3eyQUQ8qyTKjmO-Ky95pAycL5qo5NQJXBMvoDz5CS-D3ot1VbGYsr1oHVXdRi0AgO0';

export default function RecommendationDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const plan = recommendedPlans.find((item) => item.id === id) ?? recommendedPlans[0];

  return (
    <View style={styles.screen}>
      <AppHeader title="おすすめ" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileRow}>
          <Image source={{ uri: profileImage }} style={styles.profileImage} />
          <View style={styles.profileCopy}>
            <Text style={styles.planTitle}>{plan.title}</Text>
            <Text style={styles.planMeta}>
              by <Text style={styles.planMetaAccent}>user123</Text> ・ 2023年10月20日
            </Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Image source={{ uri: mapImage }} style={styles.heroImage} />
          <View style={styles.heroOverlay} />
          <View style={styles.locationPill}>
            <MaterialIcons name="location-on" size={16} color="#EC5B13" />
            <Text style={styles.locationPillText}>{plan.location}市内</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.primaryButton}>
            <MaterialIcons name="edit-calendar" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>このプランを使う</Text>
          </Pressable>

          <Pressable style={styles.bookmarkButton}>
            <MaterialIcons name="bookmark-border" size={22} color="#EC5B13" />
          </Pressable>
        </View>

        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionMarker} />
          <Text style={styles.sectionTitle}>旅の行程</Text>
        </View>

        <View style={styles.timelineWrap}>
          <View style={styles.timelineLine} />

          <View style={styles.timelineItem}>
            <View style={styles.timelineDotWrap}>
              <View style={styles.timelineDotActive} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTime}>10:00 AM</Text>
              <Text style={styles.timelinePlace}>京都駅 集合</Text>
              <Text style={styles.timelineDescription}>中央口の時計台前で待ち合わせ。旅のスタート！</Text>
            </View>
          </View>

          <View style={styles.timelineItem}>
            <View style={styles.timelineDotWrap}>
              <View style={styles.timelineDot} />
            </View>
            <View style={styles.timelineCard}>
              <View style={styles.timelineCardHeader}>
                <View>
                  <Text style={styles.timelineTime}>11:30 AM</Text>
                  <Text style={styles.timelinePlace}>% Arabica Kyoto Arashiyama</Text>
                </View>
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryTagText}>CAFE</Text>
                </View>
              </View>
              <Image source={{ uri: cafeImage }} style={styles.timelineCardImage} />
              <Text style={styles.timelineDescription}>渡月橋を眺めながらのラテタイム。景色が最高です。</Text>
            </View>
          </View>

          {timelineMock.slice(1).map((item, index) => (
            <View key={item.id} style={styles.timelineItem}>
              <View style={styles.timelineDotWrap}>
                <View style={styles.timelineDot} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTime}>{index === 0 ? '01:30 PM' : '03:30 PM'}</Text>
                <Text style={styles.timelinePlace}>{index === 0 ? '嵐山散策 & ランチ' : 'ブルーボトルコーヒー 京都カフェ'}</Text>
                <Text style={styles.timelineDescription}>
                  {index === 0
                    ? '竹林の小径を歩いてリフレッシュ。お昼はおばんざい料理。'
                    : '築100年の京町家をリノベーションした空間で休憩。'}
                </Text>
              </View>
            </View>
          ))}
        </View>
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
    paddingTop: 16,
    paddingBottom: 32,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  profileImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(236, 91, 19, 0.2)',
    backgroundColor: '#FDE7D8',
  },
  profileCopy: {
    flex: 1,
    gap: 4,
  },
  planTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#0F172A',
  },
  planMeta: {
    fontSize: 13,
    color: '#64748B',
  },
  planMetaAccent: {
    color: '#EC5B13',
    fontWeight: '700',
  },
  heroCard: {
    position: 'relative',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#E2E8F0',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
  },
  locationPill: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  locationPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 26,
  },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#EC5B13',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#EC5B13',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  bookmarkButton: {
    width: 56,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#EC5B13',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionMarker: {
    width: 6,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#EC5B13',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  timelineWrap: {
    position: 'relative',
    paddingBottom: 8,
  },
  timelineLine: {
    position: 'absolute',
    left: 19,
    top: 8,
    bottom: 8,
    width: 2,
    backgroundColor: '#E2E8F0',
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  timelineDotWrap: {
    width: 40,
    alignItems: 'center',
    paddingTop: 4,
  },
  timelineDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EC5B13',
    borderWidth: 4,
    borderColor: 'rgba(236, 91, 19, 0.18)',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(236, 91, 19, 0.4)',
    borderWidth: 4,
    borderColor: 'rgba(236, 91, 19, 0.1)',
  },
  timelineContent: {
    flex: 1,
    gap: 6,
    paddingLeft: 8,
  },
  timelineCard: {
    flex: 1,
    marginLeft: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
  },
  timelineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(236, 91, 19, 0.12)',
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EC5B13',
  },
  timelineCardImage: {
    width: '100%',
    height: 128,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  timelineTime: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#64748B',
  },
  timelinePlace: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    color: '#0F172A',
  },
  timelineDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: '#64748B',
  },
});
