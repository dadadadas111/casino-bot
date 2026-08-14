import { describe, expect, it } from 'vitest';
import {
  blackjackPayout,
  compareHands,
  createShuffledDeck,
  dealerPlay,
  handValue,
  isBlackjack,
  isBust,
  type BlackjackOutcome,
} from '../src/services/blackjack.service';

/**
 * The house edge is not obvious from the rules alone, so play a lot of hands
 * with a plain "hit until 17" player and check the table actually favours the
 * house. Production RTP looked over 100%, and this is how we tell a real bug
 * from a small-sample fluke.
 */
function playHand(): { bet: number; payout: number } {
  const bet = 100;
  const deck = createShuffledDeck();
  const player = [deck.pop()!, deck.pop()!];
  const dealer = [deck.pop()!, deck.pop()!];

  if (isBlackjack(player)) {
    const outcome: BlackjackOutcome = isBlackjack(dealer) ? 'push' : 'blackjack';
    return { bet, payout: blackjackPayout(outcome, bet) };
  }

  while (handValue(player) < 17) {
    player.push(deck.pop()!);
  }
  if (isBust(player)) return { bet, payout: 0 };

  dealerPlay(deck, dealer);
  return { bet, payout: blackjackPayout(compareHands(player, dealer), bet) };
}

describe('blackjack house edge', () => {
  it('returns between 90% and 100% over many hands', () => {
    let staked = 0;
    let paid = 0;
    for (let i = 0; i < 200_000; i++) {
      const { bet, payout } = playHand();
      staked += bet;
      paid += payout;
    }
    const rtp = paid / staked;
    expect(rtp).toBeGreaterThan(0.9);
    expect(rtp).toBeLessThan(1.0);
  });
});
