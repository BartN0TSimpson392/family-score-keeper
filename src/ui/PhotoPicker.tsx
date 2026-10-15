import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n';
import { SmallButton } from './components';
import { colors } from './theme';

/** Round selfie picker. Front camera only: there is no photo library option, so the picture really is the person. */
export function PhotoPicker({ uri, onChange, title, sub }: { uri?: string; onChange: (uri: string) => void; title?: string; sub?: string }) {
  const { t } = useI18n();
  const [problem, setProblem] = useState('');

  const take = async () => {
    setProblem('');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setProblem(t('photoNoCamera'));
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!res.canceled && res.assets[0]) onChange(res.assets[0].uri);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {uri ? (
          <Image source={{ uri }} style={styles.circle} />
        ) : (
          <View style={[styles.circle, styles.empty]}>
            <Text style={{ fontSize: 34 }}>🤳</Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>{title ?? (uri ? t('changePhoto') : t('addPhoto'))}</Text>
          <Text style={styles.sub}>{sub ?? t('photoSub')}</Text>
        </View>
      </View>
      <SmallButton label={t('photoTakeBtn')} onPress={() => take().catch((e) => console.warn('Photo failed', e))} />
      {problem ? <Text style={styles.problem}>{problem}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  circle: { width: 84, height: 84, borderRadius: 42 },
  empty: { borderWidth: 2.5, borderStyle: 'dashed', borderColor: colors.inputBorder, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '700', fontSize: 21, lineHeight: 26, color: colors.teal },
  sub: { fontSize: 18, lineHeight: 22, color: colors.muted },
  problem: { fontWeight: '700', fontSize: 18, lineHeight: 24, color: colors.danger },
});
