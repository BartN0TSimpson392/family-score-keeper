export const colors = {
  paper: '#F4F1EA',
  ink: '#1F2A44',
  muted: '#4F5B75',
  soft: '#6B7690',
  primary: '#D9531E',
  primaryShadow: '#8F3410',
  primaryTint: '#FCE9DF',
  teal: '#1F6F5C',
  tealShadow: '#124A3C',
  tealTint: '#DCEEE8',
  card: '#FFFFFF',
  border: '#D8D2C4',
  input: '#FFFFFF',
  inputBorder: '#8A93A8',
  cream: '#FFFFFF',
  danger: '#B3261E',
} as const;

// Senior-friendly minimums: body text 17+, tap targets 48+, primary buttons 76+.
export const sizes = {
  gutter: 22,
  tap: 48,
  bigButton: 80,
  radius: 20,
} as const;

/** Colours for the little circle behind a person's initial, and later for each player on the scoreboard. */
export const TINTS = ['#F4A582', '#F2D16B', '#9BCFB8', '#9DB8E8', '#D9A7D6', '#F0B6B6', '#B6D97A', '#E8C39E'] as const;
