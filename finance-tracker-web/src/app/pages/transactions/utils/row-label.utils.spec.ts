import '@common/locale/locale.utils';
import { transaction, transfer } from '../testing/transaction-fixtures.utils';
import { editRowLabel, isFromControl, selectRowLabel } from './row-label.utils';

describe('selectRowLabel', () => {
  it('names the row by its title and date', () => {
    expect(selectRowLabel(transaction(), 'en-GB')).toBe('Select Żabka, 19 Oct 2026');
  });

  it('names a transfer by its accounts', () => {
    expect(selectRowLabel(transfer({ date: '2026-10-05' }), 'en-GB')).toBe(
      'Select mBank card → Savings, 5 Oct 2026',
    );
  });
});

describe('editRowLabel', () => {
  it('contains the visible title', () => {
    expect(editRowLabel(transaction(), 'en-GB')).toBe('Edit Żabka, 19 Oct 2026');
  });
});

describe('isFromControl', () => {
  it('tells clicks on row controls from clicks on the row', () => {
    const region = document.createElement('div');
    region.tabIndex = -1;
    region.innerHTML =
      '<div class="row"><span class="text">x</span><button type="button"><span class="in">y</span></button></div>';
    const row = region.querySelector('.row');
    const click = (selector: string) =>
      ({ currentTarget: row, target: region.querySelector(selector) }) as unknown as Event;
    expect(isFromControl(click('.text'))).toBe(false);
    expect(isFromControl(click('.in'))).toBe(true);
  });
});
