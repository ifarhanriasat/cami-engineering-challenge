import { describe, expect, it } from 'vitest';
import { applyClassificationRules } from '../src/requests/classification-rules';

describe('applyClassificationRules', () => {
  it('leaves a confident multi-word verdict untouched', () => {
    expect(
      applyClassificationRules('please refund my payment', { category: 'billing', confidence: 0.86 }),
    ).toEqual({ category: 'billing', confidence: 0.86 });
  });

  it('softens confidence for messages under three words', () => {
    const result = applyClassificationRules('refund please', { category: 'billing', confidence: 0.86 });
    expect(result.category).toBe('billing');
    expect(result.confidence).toBeCloseTo(0.71);
  });

  it('never softens below the 0.5 floor', () => {
    const result = applyClassificationRules('bug', { category: 'support', confidence: 0.55 });
    // 0.55 - 0.15 -> floored at 0.5, which is then below the 0.55 threshold.
    expect(result).toEqual({ category: 'unknown', confidence: 0.5 });
  });

  it('does not soften an already-unknown verdict', () => {
    expect(applyClassificationRules('hi', { category: 'unknown', confidence: 0.4 })).toEqual({
      category: 'unknown',
      confidence: 0.4,
    });
  });

  it('demotes weak confidence to unknown but keeps the score', () => {
    expect(
      applyClassificationRules('something vague here', { category: 'sales', confidence: 0.54 }),
    ).toEqual({ category: 'unknown', confidence: 0.54 });
  });

  it('counts words on trimmed input', () => {
    const result = applyClassificationRules('  refund  ', { category: 'billing', confidence: 0.86 });
    expect(result.confidence).toBeCloseTo(0.71);
  });
});
