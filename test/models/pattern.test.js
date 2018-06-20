import { Scale, Pattern } from '../../lib';
import { STEPS, VALUES } from '../../lib/config';
import assert from 'assert';

describe('Pattern', () => {
  describe('invert()', () => {
    it('flips the steps values 1<=>4 and 2<=>3', () => {
      const pattern = new Pattern;
      pattern.sequence = Array(STEPS).fill(0).map((_, i) => i % VALUES)
      const expected = pattern.sequence.map(v => v > 0 ? VALUES - v : 0);
      pattern.invert();
      assert.deepEqual(pattern.sequence, expected);
    })
  });
});
