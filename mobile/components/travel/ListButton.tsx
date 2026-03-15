import React from 'react';
import { Link } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

type ListButtonProps = {
  title: string;
  description?: string;
  iconName?: keyof typeof MaterialIcons.glyphMap;
  href?: React.ComponentProps<typeof Link>['href'];
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

type ListButtonContentProps = Pick<ListButtonProps, 'title' | 'description' | 'iconName'>;

function ListButtonContent({ title, description, iconName }: ListButtonContentProps) {
  return (
    <View style={styles.textWrapContainer}>
      {iconName ? (
        <View style={styles.leftIconWrap}>
          <MaterialIcons name={iconName} size={20} color="#64748B" />
        </View>
      ) : null}
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
    </View>
  );
}

export function ListButton({ title, description, iconName, href, onPress, style }: ListButtonProps) {
  const button = (
    <Pressable style={[styles.button, style]} onPress={onPress}>
      <ListButtonContent title={title} description={description} iconName={iconName} />
    </Pressable>
  );

  if (href) {
    return (
      <Link href={href} asChild>
        {button}
      </Link>
    );
  }

  return button;
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    marginTop: 8,
    minHeight: 52,
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    justifyContent: 'flex-start',
  },
  textWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  textWrapContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  leftIconWrap: {
    marginRight: 10,
    width: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '700',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 20,
  },
  description: {
    fontSize: 12,
    color: '#64748B',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 18,
  },
});
