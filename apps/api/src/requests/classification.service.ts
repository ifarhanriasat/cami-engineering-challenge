import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ClassificationEvent } from './classification-event.entity';
import { applyClassificationRules } from './classification-rules';
import {
  CLASSIFIER_PROVIDER,
  ClassificationCategory,
  ClassifierProvider,
} from './classifier-provider';
import { CustomerRequest } from './customer-request.entity';

export type ClassifyOutcome = {
  category: ClassificationCategory;
  confidence: number;
  requestId: string | null;
};

export type HistoryItem = {
  id: string;
  requestId: string | null;
  message: string;
  category: string;
  confidence: number;
  provider: string;
  createdAt: string;
};

export const DEFAULT_HISTORY_LIMIT = 50;

@Injectable()
export class ClassificationService {
  constructor(
    @Inject(CLASSIFIER_PROVIDER) private readonly provider: ClassifierProvider,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(ClassificationEvent)
    private readonly events: Repository<ClassificationEvent>,
  ) {}

  /**
   * Classify `message` (already validated/trimmed by the DTO). The provider call
   * happens outside the transaction so a slow provider never holds a DB
   * connection; persisting the event and updating the request is atomic.
   */
  async classify(message: string, requestId?: string): Promise<ClassifyOutcome> {
    const raw = await this.provider.classify(message);
    const result = applyClassificationRules(message, raw);

    await this.dataSource.transaction(async (em) => {
      if (requestId) {
        const request = await em.findOneBy(CustomerRequest, { id: requestId });
        if (!request) {
          throw new NotFoundException(`Request ${requestId} not found`);
        }
        request.category = result.category;
        request.confidence = result.confidence;
        if (request.status === 'open') {
          request.status = 'in_progress';
        }
        await em.save(request);
      }

      await em.save(
        em.create(ClassificationEvent, {
          requestId: requestId ?? null,
          message,
          category: result.category,
          confidence: result.confidence,
          provider: this.provider.name,
        }),
      );
    });

    return { ...result, requestId: requestId ?? null };
  }

  async history(category?: string, limit = DEFAULT_HISTORY_LIMIT): Promise<HistoryItem[]> {
    const rows = await this.events.find({
      where: category ? { category } : {},
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
    });
    return rows.map((e) => ({
      id: e.id,
      requestId: e.requestId,
      message: e.message,
      category: e.category,
      confidence: e.confidence,
      provider: e.provider,
      createdAt: e.createdAt.toISOString(),
    }));
  }
}
