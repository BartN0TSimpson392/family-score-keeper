import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFamily } from '@/data/store';
import { useI18n } from '@/i18n';
import { Avatar, Body, H1, LanguageToggle, Screen, SmallButton, TopBar } from '@/ui/components';
import { PhotoPicker } from '@/ui/PhotoPicker';
import { colors } from '@/ui/theme';

export default function Family() {
  const router = useRouter();
  const { t, plural, lang } = useI18n();
  const { session, setMyPhoto, pendingMembers, approveMember, declineMember, members, codeFor, signOut, creatorUid, makeAdmin, removeMember } = useFamily();
  const [photoError, setPhotoError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(false);
  if (!session.signedIn) return <Redirect href="/welcome" />;
  if (session.pending) return <Redirect href="/waiting" />;

  const words = codeFor(lang).join(' ');
  const run = (p: Promise<void>) => {
    setActionError(false);
    p.catch((e) => {
      console.warn('Action failed', (e as { code?: string })?.code ?? e);
      setActionError(true);
    });
  };

  const confirmRemove = (id: string, name: string) =>
    Alert.alert(t('removeH', { name }), t('removeSure'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('removeBtn'), style: 'destructive', onPress: () => run(removeMember(id)) },
    ]);

  const confirmSignOut = () =>
    Alert.alert(t('signOut'), t('signOutSure'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('signOut'),
        style: 'destructive',
        onPress: () => {
          signOut();
          router.dismissAll();
          router.replace('/welcome');
        },
      },
    ]);

  return (
    <Screen>
      <TopBar onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 28 }}>
        <View style={{ gap: 4 }}>
          <H1>{t('familyH')}</H1>
          <Body>{plural('peopleCount', members.length)}</Body>
        </View>

        {session.isAdmin && pendingMembers.length > 0 ? (
          <View style={styles.pending}>
            <Text style={styles.pendingHead}>{t('pendingH')}</Text>
            <Text style={styles.note}>{t('pendingSure')}</Text>
            {pendingMembers.map((m) => (
              <View key={m.id} style={styles.pendingCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Avatar name={m.name} tint={m.tint} photoUri={m.photoUri} size={84} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{m.name}</Text>
                    <Text style={styles.note}>{t('wantsToJoin')}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <SmallButton label={t('approve')} tone="primary" style={{ flex: 1, minHeight: 56 }} onPress={() => run(approveMember(m.id))} />
                  <SmallButton label={t('decline')} style={{ flex: 1, minHeight: 56 }} onPress={() => run(declineMember(m.id))} />
                </View>
              </View>
            ))}
          </View>
        ) : null}
        {actionError ? <Text style={[styles.note, { color: colors.danger }]}>{t('approveFailed')}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('familyCode')}</Text>
          <Text style={styles.code}>{words}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <SmallButton label={t('sendShort')} tone="primary" style={{ flex: 1 }} onPress={() => Share.share({ message: `${t('appName')}\n${words}` }).catch(() => {})} />
            {session.isAdmin ? <SmallButton label={t('newCodeBtn')} style={{ flex: 1 }} onPress={() => router.push('/newcode')} /> : null}
          </View>
        </View>

        <View style={styles.langRow}>
          <Text style={styles.langLabel}>{t('language')}</Text>
          <LanguageToggle />
        </View>

        <View style={styles.card}>
          <PhotoPicker
            uri={members.find((m) => m.id === session.uid)?.photoUri}
            onChange={(uri) => {
              setPhotoError(false);
              setSaving(true);
              setMyPhoto(uri)
                .catch(() => setPhotoError(true))
                .finally(() => setSaving(false));
            }}
          />
          {saving ? <Text style={styles.note}>{t('working')}</Text> : null}
          {photoError ? <Text style={[styles.note, { color: colors.danger }]}>{t('myPhotoFailed')}</Text> : null}
        </View>

        <Text style={styles.section}>{t('membersH')}</Text>
        <View style={{ gap: 8 }}>
          {members.map((m) => {
            const isYou = m.id === session.uid;
            const note = m.isAdmin ? (isYou ? t('adminYou') : t('admin')) : isYou ? t('you') : '';
            const canManage = session.isAdmin && !isYou && m.id !== creatorUid;
            return (
              <View key={m.id} style={styles.member}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={m.name} tint={m.tint} photoUri={m.photoUri} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{m.name}</Text>
                    {note ? <Text style={styles.note}>{note}</Text> : null}
                  </View>
                </View>
                {canManage ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {!m.isAdmin ? <SmallButton label={t('makeAdmin')} style={{ flex: 1, minHeight: 44 }} onPress={() => run(makeAdmin(m.id))} /> : null}
                    <SmallButton label={t('removeBtn')} style={{ flex: 1, minHeight: 44, borderColor: colors.danger }} onPress={() => confirmRemove(m.id, m.name)} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <SmallButton label={t('signOut')} style={{ minHeight: 60, borderColor: colors.inputBorder }} onPress={confirmSignOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pending: { gap: 10, padding: 16, borderRadius: 18, backgroundColor: colors.primaryTint, borderWidth: 2, borderColor: colors.primary },
  pendingHead: { fontWeight: '800', fontSize: 23, lineHeight: 30, color: colors.primaryShadow },
  pendingCard: { gap: 12, padding: 12, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  card: { padding: 16, gap: 10, borderRadius: 18, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.inputBorder },
  cardLabel: { fontWeight: '700', fontSize: 16, letterSpacing: 1.3, textTransform: 'uppercase', color: colors.teal },
  code: { fontWeight: '800', fontSize: 22, lineHeight: 30, color: colors.ink },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  langLabel: { fontWeight: '700', fontSize: 20, color: colors.ink },
  section: { fontWeight: '700', fontSize: 20, lineHeight: 24, color: colors.ink },
  member: { gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  name: { fontWeight: '700', fontSize: 21, lineHeight: 25, color: colors.ink },
  note: { fontSize: 16, lineHeight: 20, color: colors.muted },
});
