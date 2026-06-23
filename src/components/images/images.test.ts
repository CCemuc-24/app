import { describe, it, expect } from 'vitest';
import courseImagesDictionary from './images';

describe('courseImagesDictionary', () => {
  it('maps card indexes 1..8 to an image with a src', () => {
    for (let i = 1; i <= 8; i++) {
      const img = courseImagesDictionary[i];
      expect(img).toBeDefined();
      const src = typeof img === 'string' ? img : img.src;
      expect(typeof src).toBe('string');
      expect(src.length).toBeGreaterThan(0);
    }
  });
});
