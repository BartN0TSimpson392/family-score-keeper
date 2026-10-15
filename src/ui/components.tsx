import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LANGUAGES, useI18n } from '@/i18n';
import { colors, sizes } from './theme';

/* ---------- Text ---------- */

export function H1({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text accessibilityRole="header" style={[styles.h1, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {children}
    </Text>
  );
}

/* ---------- Layout ---------- */

export function Screen({
  children,
  style,
  bottom,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Pinned to the bottom of the screen, e.g. the primary button. */
  bottom?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={[styles.screenInner, style]}>{children}</View>
      {bottom ? <View style={styles.bottom}>{bottom}</View> : null}
    </SafeAreaView>
  );
}

export function TopBar({ onBack, backLabel }: { onBack?: () => void; backLabel?: string }) {
  const { t } = useI18n();
  return (
    <View style={styles.topBar}>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={backLabel ?? t('back')} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>{backLabel ?? t('back')}</Text>
        </Pressable>
      ) : (
        <View />
      )}
    </View>
  );
}

/* ---------- Buttons ---------- */

type Tone = 'primary' | 'teal' | 'outline';

export function BigButton({
  label,
  sub,
  onPress,
  tone = 'primary',
  height = sizes.bigButton,
  disabled,
  style,
}: {
  label: string;
  sub?: string;
  onPress: () => void;
  tone?: Tone;
  height?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const filled = tone !== 'outline';
  const bg = tone === 'primary' ? colors.primary : colors.teal;
  const shadow = tone === 'primary' ? colors.primaryShadow : colors.tealShadow;
  const fg = filled ? colors.cream : colors.teal;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={() => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.bigBtn,
        { minHeight: height },
        filled
          ? { backgroundColor: bg, borderBottomWidth: pressed ? 1 : 5, borderBottomColor: shadow, marginTop: pressed ? 4 : 0 }
          : { borderWidth: 2.5, borderColor: colors.teal, backgroundColor: pressed ? colors.tealTint : 'transparent' },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      <View style={styles.bigBtnText}>
        <Text numberOfLines={2} style={[styles.bigBtnLabel, height < 70 && styles.bigBtnLabelSmall, { color: fg }]}>
          {label}
        </Text>
        {sub ? <Text style={[styles.bigBtnSub, { color: filled ? '#FFE9DA' : colors.muted }]}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}

export function SmallButton({
  label,
  onPress,
  tone = 'outline',
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: 'outline' | 'primary';
  style?: StyleProp<ViewStyle>;
}) {
  const filled = tone === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallBtn,
        filled ? { backgroundColor: colors.primary } : { borderWidth: 2, borderColor: colors.teal },
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      <Text style={[styles.smallBtnText, { color: filled ? colors.cream : colors.teal }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Inputs ---------- */

export function Field({ label, ref, ...input }: { label: string; ref?: React.Ref<TextInput> } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.soft}
        {...input}
        style={[styles.input, input.multiline && styles.inputMulti, input.style]}
      />
    </View>
  );
}

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <View style={styles.toggle} accessibilityRole="radiogroup">
      {LANGUAGES.map((l) => {
        const active = l.code === lang;
        return (
          <Pressable
            key={l.code}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => setLang(l.code)}
            style={[styles.toggleBtn, active && { backgroundColor: colors.teal }]}
          >
            <Text style={[styles.toggleText, { color: active ? colors.cream : colors.teal }]}>{l.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Cards ---------- */

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

/** A person's round picture: their selfie if they have one, otherwise the first letter of their name on their colour. */
export function Avatar({ name, tint, photoUri, size = 46 }: { name: string; tint: string; photoUri?: string; size?: number }) {
  if (photoUri) return <Image source={{ uri: photoUri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontWeight: '700', fontSize: size * 0.48, color: colors.ink }}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontWeight: '800', fontSize: 34, lineHeight: 40, color: colors.ink },
  body: { fontSize: 20, lineHeight: 28, color: colors.muted },
  error: { fontWeight: '700', fontSize: 19, lineHeight: 26, color: colors.danger },

  screen: { flex: 1, backgroundColor: colors.paper },
  screenInner: { flex: 1, paddingHorizontal: sizes.gutter, gap: 14 },
  bottom: { paddingHorizontal: sizes.gutter, paddingBottom: 12, paddingTop: 8, gap: 12 },

  topBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: sizes.tap, paddingRight: 14 },
  backArrow: { fontSize: 34, lineHeight: 36, color: colors.teal },
  backText: { fontWeight: '700', fontSize: 20, color: colors.teal },

  bigBtn: {
    borderRadius: sizes.radius,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigBtnText: { alignItems: 'center', flexShrink: 1, minWidth: 0, gap: 2 },
  bigBtnLabel: { fontWeight: '800', fontSize: 25, lineHeight: 30, textAlign: 'center' },
  bigBtnLabelSmall: { fontSize: 21, lineHeight: 26 },
  bigBtnSub: { fontSize: 17, lineHeight: 22, textAlign: 'center' },

  smallBtn: { minHeight: 52, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { fontWeight: '700', fontSize: 18 },

  fieldLabel: { fontWeight: '700', fontSize: 20, lineHeight: 24, color: colors.ink },
  input: {
    height: 64,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    borderRadius: 16,
    backgroundColor: colors.input,
    paddingHorizontal: 18,
    fontSize: 24,
    color: colors.ink,
  },
  inputMulti: { height: 150, paddingTop: 14, textAlignVertical: 'top', fontSize: 24, lineHeight: 34 },

  toggle: { flexDirection: 'row', borderWidth: 2, borderColor: colors.teal, borderRadius: 24, overflow: 'hidden' },
  toggleBtn: { height: 44, paddingHorizontal: 16, justifyContent: 'center' },
  toggleText: { fontWeight: '700', fontSize: 18 },

  notice: { padding: 16, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  noticeText: { fontSize: 18, lineHeight: 25, color: colors.ink },
});
