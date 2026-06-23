// src/schemas/purchase.ts
import { z } from 'zod';

// Mirrors ccemuc-api/src/interfaces/purchase.interface.ts (PurchaseAttributes, minus id).
// buyOrder and isPaid are server-generated, never client input.
export const purchaseCreateSchema = z.object({
  userId: z.string().uuid(),
  coursesIds: z.array(z.string().uuid()).min(1),
});

// Server-side confirmation: the action loads the purchase + courses and builds the
// email HTML itself, so the client only supplies the purchase id and recipient email.
export const sendConfirmationSchema = z.object({
  purchaseId: z.string().uuid(),
  email: z.string().email(),
});

// Fix 9: updatePurchase input validation (replaces casting to Prisma.PurchaseUpdateInput).
export const updatePurchaseSchema = z.object({
  isPaid: z.boolean().optional(),
  buyOrder: z.string().optional(),
});

export type PurchaseCreateInput = z.infer<typeof purchaseCreateSchema>;
export type SendConfirmationInput = z.infer<typeof sendConfirmationSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
