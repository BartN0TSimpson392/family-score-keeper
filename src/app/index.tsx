import { StyleSheet, Text, View } from 'react-native';

// A tiny first screen, just to prove the app opens on a phone. We replace it in the next steps.
export default function Home() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Family Score Keeper</Text>
      <Text style={styles.sub}>It works! 🎉</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F1EA', gap: 12 },
  title: { fontSize: 32, fontWeight: '700', color: '#1F2A44' },
  sub: { fontSize: 20, color: '#1F2A44' },
});
