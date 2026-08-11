import { describe, expect, it } from 'vitest';
import {
  type Card,
  blackjackPayout,
  compareHands,
  createShuffledDeck,
  dealerPlay,
  handValue,
  isBlackjack,
  isBust,
} from '../src/services/blackjack.service';

const c = (rank: Card['rank'], suit: Card['suit'] = '♠'): Card => ({ rank, suit });

describe('handValue', () => {
  it('counts number cards and faces', () => {
    expect(handValue([c('2'), c('3')])).toBe(5);
    expect(handValue([c('K'), c('Q')])).toBe(20);
    expect(handValue([c('10'), c('J')])).toBe(20);
  });

  it('counts ace as 11 when possible', () => {
    expect(handValue([c('A'), c('K')])).toBe(21);
    expect(handValue([c('A'), c('5')])).toBe(16);
  });

  it('downgrades aces to 1 to avoid busting', () => {
    expect(handValue([c('A'), c('A')])).toBe(12);
    expect(handValue([c('A'), c('A'), c('9')])).toBe(21);
    expect(handValue([c('A'), c('K'), c('5')])).toBe(16);
  });
});

describe('isBlackjack / isBust', () => {
  it('detects a natural', () => {
    expect(isBlackjack([c('A'), c('K')])).toBe(true);
    expect(isBlackjack([c('7'), c('7'), c('7')])).toBe(false);
    expect(isBlackjack([c('10'), c('9')])).toBe(false);
  });

  it('detects a bust', () => {
    expect(isBust([c('K'), c('Q'), c('5')])).toBe(true);
    expect(isBust([c('K'), c('Q'), c('A')])).toBe(false);
  });
});

describe('dealerPlay', () => {
  it('draws until at least 17 and stands on all 17s', () => {
    const deck = [c('2'), c('2'), c('2'), c('2'), c('2'), c('2'), c('2')];
    const dealer = [c('10'), c('5')];
    dealerPlay(deck, dealer);
    expect(handValue(dealer)).toBeGreaterThanOrEqual(17);
    expect(dealer.length).toBe(3); // 15 + 2 = 17, stop immediately
  });

  it('does not draw when already at 17', () => {
    const deck = [c('5')];
    const dealer = [c('10'), c('7')];
    dealerPlay(deck, dealer);
    expect(dealer.length).toBe(2);
  });
});

describe('compareHands / blackjackPayout', () => {
  it('player wins when dealer busts', () => {
    expect(compareHands([c('10'), c('8')], [c('10'), c('6'), c('K')])).toBe('win');
  });

  it('higher hand wins, equal is push', () => {
    expect(compareHands([c('10'), c('9')], [c('10'), c('8')])).toBe('win');
    expect(compareHands([c('10'), c('7')], [c('10'), c('8')])).toBe('lose');
    expect(compareHands([c('10'), c('8')], [c('9'), c('9')])).toBe('push');
  });

  it('pays 3:2 on blackjack, 1:1 on win, refund on push', () => {
    expect(blackjackPayout('blackjack', 100)).toBe(250);
    expect(blackjackPayout('win', 100)).toBe(200);
    expect(blackjackPayout('push', 100)).toBe(100);
    expect(blackjackPayout('lose', 100)).toBe(0);
  });
});

describe('createShuffledDeck', () => {
  it('produces 52 unique cards', () => {
    const deck = createShuffledDeck();
    expect(deck.length).toBe(52);
    const unique = new Set(deck.map((card) => `${card.rank}${card.suit}`));
    expect(unique.size).toBe(52);
  });
});
