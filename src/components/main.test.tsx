import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/mainPage/firstSection', () => ({ default: () => <div>first</div> }));
vi.mock('@/components/mainPage/countDownSection', () => ({ default: () => <div>countdown</div> }));
vi.mock('@/components/mainPage/announcementSection', () => ({ default: () => <div>announcement</div> }));
vi.mock('@/components/mainPage/modalitySection', () => ({ default: () => <div>modality</div> }));
vi.mock('@/components/mainPage/CcemSection', () => ({ default: () => <div>ccem</div> }));
vi.mock('@/components/mainPage/datesSection', () => ({ default: () => <div>dates</div> }));
vi.mock('@/components/mainPage/sponsorSection', () => ({ default: () => <div>sponsor</div> }));
vi.mock('@/components/mainPage/organizationSection', () => ({ default: () => <div>organization</div> }));

import Main from './main';

describe('Main', () => {
  it('composes all eight landing sections in order', () => {
    render(<Main />);
    const order = ['first', 'countdown', 'announcement', 'modality', 'ccem', 'dates', 'sponsor', 'organization'];
    for (const marker of order) {
      expect(screen.getByText(marker)).toBeInTheDocument();
    }
    const html = document.body.innerHTML;
    let last = -1;
    for (const marker of order) {
      const idx = html.indexOf(marker);
      expect(idx).toBeGreaterThan(last);
      last = idx;
    }
  });
});
