// src/domain/buyOrder.test.ts
import { describe, it, expect } from 'vitest';
import { generateBuyOrder } from './buyOrder';

describe('generateBuyOrder', () => {
  it('returns a 26-character string', () => {
    expect(generateBuyOrder()).toHaveLength(26);
  });
  it('returns only lowercase hex characters', () => {
    expect(generateBuyOrder()).toMatch(/^[0-9a-f]{26}$/);
  });
  it('returns different values across calls (non-deterministic)', () => {
    const a = generateBuyOrder();
    const b = generateBuyOrder();
    expect(a).not.toBe(b);
  });
});
