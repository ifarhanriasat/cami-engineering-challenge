import { describe, expect, it } from 'vitest';
import { KeywordClassifier } from '../src/requests/keyword-classifier';

describe('KeywordClassifier', () => {
  const classifier = new KeywordClassifier();

  it('classifies billing messages', async () => {
    const result = await classifier.classify('Please fix my invoice and payment charge');
    expect(result.category).toBe('billing');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('returns unknown for unrelated text', async () => {
    const result = await classifier.classify('Hello there');
    expect(result.category).toBe('unknown');
  });

  it('identifies itself for history rows', () => {
    expect(classifier.name).toBe('keyword-v1');
  });
});
