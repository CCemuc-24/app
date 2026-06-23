// src/domain/buyOrder.ts
// Ported from Purchase.generateBuyOrder (@BeforeCreate hook), ccemuc-api/src/models/purchase.model.ts.
import { createHash } from 'crypto';

export function generateBuyOrder(): string {
  const randomString = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now().toString(36);
  const rawBuyOrder = `${timestamp}${randomString}`;

  const hash = createHash('sha256').update(rawBuyOrder).digest('hex');

  return hash.substring(0, 26);
}
