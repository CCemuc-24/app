// src/domain/rut.test.ts
import { describe, it, expect } from 'vitest';
import { isRut, getDV } from './rut';

describe('getDV', () => {
  it('computes DV for an 8-digit body', () => {
    expect(getDV('12345678')).toBe('5');
  });
  it('computes DV for a 7-digit body', () => {
    expect(getDV('1234567')).toBe('4');
  });
  it('returns "K" when the check digit is K', () => {
    expect(getDV('10000013')).toBe('K');
  });
  it('returns "0" when the modulus result is 11', () => {
    expect(getDV('10000004')).toBe('0');
  });
  it('returns false for an out-of-range length', () => {
    expect(getDV('123')).toBe(false);
    expect(getDV('123456789')).toBe(false);
  });
});

describe('isRut', () => {
  it('accepts a valid dashed RUT', () => {
    expect(isRut('12345678-5')).toEqual({ status: true, message: 'Valid RUT' });
  });
  it('accepts a lowercase k DV (case-insensitive)', () => {
    expect(isRut('10000013-k').status).toBe(true);
  });
  it('rejects a RUT containing dots', () => {
    const r = isRut('12.345.678-5');
    expect(r.status).toBe(false);
    expect(r.message).toBe('RUT must not contain dots Format: XX.XXX.XXX-X');
  });
  it('rejects a RUT without a dash', () => {
    const r = isRut('123456785');
    expect(r.status).toBe(false);
    expect(r.message).toBe('RUT must contain dashes');
  });
  it('rejects a body of the wrong length', () => {
    const r = isRut('123-5');
    expect(r.status).toBe(false);
    expect(r.message).toBe('RUT without DV must have 9 or 10 digits');
  });
  it('rejects an incorrect DV and reports the expected one', () => {
    const r = isRut('12345678-9');
    expect(r.status).toBe(false);
    expect(r.message).toBe('Invalid DV. Expected: 5');
  });
});
