import { MaterialIcons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';

export type PhotoCardData = {
  id: string;
  title: string;
  location: string;
  image: string;
  author: string;
  likes: number;
};

export function PhotoCard({ item }: { item: PhotoCardData }) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: item.image }} style={styles.photo} />
      <View style={styles.body}>
        <Text style={styles.location}>{item.location}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.author} numberOfLines={1}>
          by {item.author}
        </Text>
        <View style={styles.footer}>
          <MaterialIcons name="favorite" size={14} color="#F97316" />
          <Text style={styles.likes}>{item.likes.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 220,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  photo: {
    width: 220,
    height: 130,
    backgroundColor: '#E2E8F0',
  },
  body: {
    padding: 10,
    gap: 4,
  },
  location: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  author: {
    fontSize: 12,
    color: '#64748B',
  },
  footer: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likes: {
    fontSize: 12,
    color: '#64748B',
  },
});
