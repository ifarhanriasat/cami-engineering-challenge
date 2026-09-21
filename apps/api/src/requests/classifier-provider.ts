export type ClassificationCategory = 'support' | 'sales' | 'billing' | 'unknown';

export const CLASSIFICATION_CATEGORIES: readonly ClassificationCategory[] = [
  'support',
  'sales',
  'billing',
  'unknown',
];

export type ClassificationResult = {
  category: ClassificationCategory;
  confidence: number;
};

/**
 * Port for anything that can label a customer message. Async on purpose: a
 * future LLM-backed provider is network I/O that can be slow, fail or time out.
 * Providers return a raw verdict only; product rules (confidence softening,
 * "unknown" threshold) live in classification-rules.ts so they apply uniformly.
 */
export interface ClassifierProvider {
  /** Stable identifier persisted with each history row, e.g. "keyword-v1". */
  readonly name: string;
  classify(message: string): Promise<ClassificationResult>;
}

/** Nest injection token — interfaces have no runtime identity. */
export const CLASSIFIER_PROVIDER = Symbol('CLASSIFIER_PROVIDER');
