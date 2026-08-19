import { RANK_ORDER, SUITS, formatCard, type Card, type Rank, type Suit } from './cards.js';

export type { Card, Rank, Suit };

const RANKS = RANK_ORDER;

export function createShuffledDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Best hand value counting aces as 11 where possible without busting. */
export function handValue(hand: Card[]): number {
  let value = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 'A') {
      aces++;
      value += 11;
    } else if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') {
      value += 10;
    } else {
      value += Number(card.rank);
    }
  }
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  return value;
}

export function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handValue(hand) === 21;
}

export function isBust(hand: Card[]): boolean {
  return handValue(hand) > 21;
}

/** Dealer draws until reaching 17 or more (stands on all 17s). */
export function dealerPlay(deck: Card[], dealer: Card[]): void {
  while (handValue(dealer) < 17) {
    const card = deck.pop();
    if (!card) break;
    dealer.push(card);
  }
}

// Emoji presentation (U+FE0F) renders hearts/diamonds red and spades/clubs
// black on every platform; inline code would disable emoji, so no backticks.
export { formatCard };

export function formatHand(hand: Card[], hideSecond = false): string {
  if (hideSecond && hand.length >= 2) {
    return `${formatCard(hand[0])}  🎴`;
  }
  return hand.map((c) => formatCard(c)).join('  ');
}

export type BlackjackOutcome = 'blackjack' | 'win' | 'push' | 'lose';

/** Total payout for a settled game, given the per-hand bet already debited. */
export function blackjackPayout(outcome: BlackjackOutcome, totalBet: number): number {
  switch (outcome) {
    case 'blackjack':
      return totalBet + Math.floor(totalBet * 1.5);
    case 'win':
      return totalBet * 2;
    case 'push':
      return totalBet;
    case 'lose':
      return 0;
  }
}

/** Compare final hands (call only when the player has not busted). */
export function compareHands(player: Card[], dealer: Card[]): BlackjackOutcome {
  const p = handValue(player);
  const d = handValue(dealer);
  if (d > 21) return 'win';
  if (p > d) return 'win';
  if (p < d) return 'lose';
  return 'push';
}
