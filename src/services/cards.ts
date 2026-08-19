/** Card primitives shared by every card game in the bot. */

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
export const RANK_ORDER: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const SUIT_EMOJI: Record<Suit, string> = {
  '♠': '♠️',
  '♥': '♥️',
  '♦': '♦️',
  '♣': '♣️',
};

export function formatCard(card: Card): string {
  return `${card.rank}${SUIT_EMOJI[card.suit]}`;
}

/** One card from a full deck, drawn with replacement. */
export function drawCard(rng: () => number = Math.random): Card {
  return {
    rank: RANK_ORDER[Math.floor(rng() * RANK_ORDER.length)],
    suit: SUITS[Math.floor(rng() * SUITS.length)],
  };
}
