import type { Mode } from './types';

export type Category = 'cards' | 'dice' | 'board' | 'lawn';

/** A well-known game with its usual rules filled in. The family can still change anything before starting. */
export type Preset = {
  id: string;
  /** Also the game's name in History and Stats, so everyone who plays it shares one record. */
  name: string;
  cat: Category;
  mode: Mode;
  /** Count down only: the starting score. */
  start: number;
  /** The usual target. Null means "highest score wins when you end the game". */
  target: number | null;
  /** Reaching the target loses and the lowest score wins. */
  penalty?: boolean;
  /** How it is normally played: alone, in teams, or either. */
  sides: 'solo' | 'teams' | 'either';
  /** Card games turn the dealer reminder on. */
  dealer: boolean;
  min: number;
  max: number;
  /** Must lead by this many points (2 for ping pong). */
  winBy?: number;
  /** Has its own scoring screen. */
  scorer?: 'tap' | 'cornhole';
  /** The serve moves every few points. */
  serve?: boolean;
};

const up = (id: string, name: string, cat: Category, target: number | null, sides: Preset['sides'], min: number, max: number, dealer = false, penalty = false): Preset => ({
  id, name, cat, mode: 'up', start: 0, target, penalty, sides, dealer, min, max,
});

export const PRESETS: Preset[] = [
  // Card games
  up('hearts', 'Hearts', 'cards', 100, 'solo', 3, 6, true, true),
  up('spades', 'Spades', 'cards', 500, 'teams', 4, 4, true),
  up('euchre', 'Euchre', 'cards', 10, 'teams', 4, 4, true),
  up('pinochle', 'Pinochle', 'cards', 150, 'teams', 4, 4, true),
  up('pitch', 'Pitch', 'cards', 11, 'teams', 4, 4, true),
  up('canasta', 'Canasta', 'cards', 5000, 'teams', 4, 4, true),
  up('rummy500', 'Rummy 500', 'cards', 500, 'solo', 2, 8, true),
  up('ginrummy', 'Gin Rummy', 'cards', 100, 'solo', 2, 2, true),
  up('cribbage', 'Cribbage', 'cards', 121, 'either', 2, 4, true),
  up('uno', 'Uno', 'cards', 500, 'solo', 2, 8, true),
  up('blackjack', 'Blackjack', 'cards', null, 'solo', 2, 8, true),
  // Dice games
  up('yahtzee', 'Yahtzee', 'dice', null, 'solo', 1, 8),
  up('farkle', 'Farkle', 'dice', 10000, 'solo', 2, 8),
  // Board games
  up('scrabble', 'Scrabble', 'board', null, 'either', 2, 4),
  up('catan', 'Catan', 'board', 10, 'solo', 3, 4),
  up('tickettoride', 'Ticket to Ride', 'board', null, 'solo', 2, 5),
  up('dominoes', 'Dominoes', 'board', 100, 'either', 2, 4),
  up('backgammon', 'Backgammon', 'board', 7, 'solo', 2, 2),
  { id: 'darts501', name: 'Darts 501', cat: 'board', mode: 'down', start: 501, target: 0, sides: 'either', dealer: false, min: 2, max: 8 },
  { id: 'darts301', name: 'Darts 301', cat: 'board', mode: 'down', start: 301, target: 0, sides: 'either', dealer: false, min: 2, max: 8 },
  // Lawn and sport games
  { ...up('cornhole', 'Cornhole', 'lawn', 21, 'either', 2, 4), scorer: 'cornhole' },
  { ...up('pingpong', 'Ping Pong', 'lawn', 11, 'either', 2, 4), winBy: 2, scorer: 'tap', serve: true },
  { ...up('pickleball', 'Pickleball', 'lawn', 11, 'either', 2, 4), winBy: 2, scorer: 'tap' },
  { ...up('volleyball', 'Volleyball', 'lawn', 25, 'teams', 2, 8), winBy: 2, scorer: 'tap' },
  { ...up('spikeball', 'Spikeball', 'lawn', 21, 'teams', 4, 4), winBy: 2, scorer: 'tap' },
  up('horseshoes', 'Horseshoes', 'lawn', 21, 'either', 2, 4),
  up('bocce', 'Bocce', 'lawn', 12, 'either', 2, 8),
  up('bowling', 'Bowling', 'lawn', null, 'solo', 1, 8),
];

export function presetByName(name: string): Preset | undefined {
  const key = name.trim().toLowerCase();
  return key ? PRESETS.find((p) => p.name.toLowerCase() === key) : undefined;
}

export const CATEGORIES: Category[] = ['cards', 'dice', 'board', 'lawn'];

export function presetById(id: string | undefined): Preset | undefined {
  return id ? PRESETS.find((p) => p.id === id) : undefined;
}
