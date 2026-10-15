/** Lowercase and strip accents so "zolty" matches "żółty". "ł" does not decompose, so map it by hand. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}
