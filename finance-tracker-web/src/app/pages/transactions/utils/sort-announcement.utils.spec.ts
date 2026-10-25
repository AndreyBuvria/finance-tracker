import { sortAnnouncement } from './sort-announcement.utils';

describe('sortAnnouncement', () => {
  it('names the column and the direction', () => {
    expect(sortAnnouncement('-amount')).toBe('Sorted by Amount, descending');
    expect(sortAnnouncement('merchant')).toBe('Sorted by Merchant/Note, ascending');
  });
});
