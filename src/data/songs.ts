import { Linking } from 'react-native';
import type { LiveGame, Member } from './types';

/** Pulls the 22-character track id out of a pasted Spotify link ("Share > Copy link") or a spotify:track: address. */
export function parseSpotifyTrack(input: string): string | null {
  const text = input.trim();
  const web = text.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})/);
  if (web) return web[1];
  const uri = text.match(/^spotify:track:([A-Za-z0-9]{22})/);
  return uri ? uri[1] : null;
}

/** Asks Spotify for the song's name and artist (no sign-in needed). Returns nothing if it could not be reached. */
export async function lookupTitle(trackId: string): Promise<string | undefined> {
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${trackId}`)}`);
    if (!res.ok) return undefined;
    const json = (await res.json()) as { title?: string };
    return json.title;
  } catch {
    return undefined;
  }
}

/** Opens the song in the Spotify app (or the web player if the app is missing). */
export async function playTrack(trackId: string): Promise<void> {
  try {
    await Linking.openURL(`spotify:track:${trackId}`);
  } catch {
    await Linking.openURL(`https://open.spotify.com/track/${trackId}`).catch(() => {});
  }
}

/** The victory song for whoever won: the winner's own, or the first teammate who has one. */
export function songFor(game: LiveGame, winnerUids: string[], members: Member[]): string | null {
  for (const side of game.players.filter((p) => winnerUids.includes(p.uid))) {
    const people = side.members && side.members.length > 0 ? side.members.map((m) => m.uid) : [side.uid];
    for (const uid of people) {
      const id = members.find((m) => m.id === uid)?.songId;
      if (id) return id;
    }
  }
  return null;
}
