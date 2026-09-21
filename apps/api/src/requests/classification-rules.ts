import { ClassificationResult } from './classifier-provider';

export const MAX_MESSAGE_LENGTH = 2000;
const MIN_CONFIDENCE_FOR_CATEGORY = 0.55;
const SHORT_MESSAGE_WORDS = 3;

/**
 * Product rules applied on top of any provider's raw verdict. Pure so they can
 * be unit-tested and stay identical if the provider becomes an LLM.
 */
export function applyClassificationRules(
  message: string,
  raw: ClassificationResult,
): ClassificationResult {
  let result = raw;

  // Soften confidence for very short messages.
  if (message.trim().split(/\s+/).length < SHORT_MESSAGE_WORDS && result.category !== 'unknown') {
    result = {
      category: result.category,
      confidence: Math.max(0.5, result.confidence - 0.15),
    };
  }

  // Prefer "unknown" when confidence is weak.
  if (result.confidence < MIN_CONFIDENCE_FOR_CATEGORY) {
    result = { category: 'unknown', confidence: result.confidence };
  }

  return result;
}
