import { View } from 'react-native';
import { Avatar } from '@/ui/components';

type Member = { uid: string; name: string; tint: string; photoUri?: string };

/** One person's picture, or a small overlapping row of faces for a team. */
export function SideAvatar({
  name,
  tint,
  photoUri,
  members,
  photoOf,
  size = 46,
}: {
  name: string;
  tint: string;
  photoUri?: string;
  members?: Member[];
  /** Looks up a person's current selfie (saved games only remember names and colors). */
  photoOf?: (uid: string) => string | undefined;
  size?: number;
}) {
  if (!members || members.length === 0) return <Avatar name={name} tint={tint} photoUri={photoUri} size={size} />;
  const shown = members.slice(0, 4);
  const small = shown.length === 1 ? size : Math.round(size * (shown.length > 2 ? 0.62 : 0.72));
  const overlap = Math.round(small * 0.3);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', width: shown.length * small - (shown.length - 1) * overlap, height: size }}>
      {shown.map((m, i) => (
        <View key={m.uid} style={{ marginLeft: i === 0 ? 0 : -overlap, borderRadius: small / 2, borderWidth: 2, borderColor: '#FFFFFF' }}>
          <Avatar name={m.name} tint={m.tint} photoUri={m.photoUri ?? photoOf?.(m.uid)} size={small - 4} />
        </View>
      ))}
    </View>
  );
}
