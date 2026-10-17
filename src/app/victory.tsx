import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useI18n } from '@/i18n';
import { BigButton } from '@/ui/components';
import { colors } from '@/ui/theme';

/** Spotify's own player in a small web page. It asks the player to start by itself as soon as it is ready. */
function pageFor(trackId: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#1F2A44"><div id="embed"></div>
<script src="https://open.spotify.com/embed/iframe-api/v1" async></script>
<script>
window.onSpotifyIframeApiReady = function (api) {
  api.createController(document.getElementById('embed'), { uri: 'spotify:track:${trackId}', width: '100%', height: 152 }, function (c) {
    c.addListener('ready', function () { c.play(); setTimeout(function () { c.resume(); }, 900); });
  });
};
</script></body></html>`;
}

export default function Victory() {
  const { t } = useI18n();
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const html = useMemo(() => (id ? pageFor(String(id)) : ''), [id]);

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.top}>
        <Text style={styles.trophy}>🏆</Text>
        {name ? <Text style={styles.name}>{name}</Text> : null}
        <Text style={styles.sub}>{t('victoryWins')}</Text>
      </View>
      {id ? (
        <View style={styles.player}>
          <WebView
            source={{ html, baseUrl: 'https://open.spotify.com' }}
            originWhitelist={['*']}
            javaScriptEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            allowsFullscreenVideo={false}
            scrollEnabled={false}
            style={styles.web}
          />
          <Text style={styles.hint}>{t('victoryHint')}</Text>
        </View>
      ) : null}
      <View style={styles.bottom}>
        <BigButton label={t('close')} onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: 16 },
  top: { alignItems: 'center', paddingTop: 24, gap: 6 },
  trophy: { fontSize: 72 },
  name: { fontSize: 34, fontWeight: '800', color: colors.cream, textAlign: 'center' },
  sub: { fontSize: 20, color: colors.cream, opacity: 0.8 },
  player: { marginTop: 24, gap: 10 },
  web: { height: 152, backgroundColor: 'transparent' },
  hint: { color: colors.cream, opacity: 0.7, textAlign: 'center', fontSize: 15 },
  bottom: { marginTop: 'auto', paddingBottom: 12 },
});
