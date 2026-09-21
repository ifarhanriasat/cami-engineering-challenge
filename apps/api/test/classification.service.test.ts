import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ClassificationService } from '../src/requests/classification.service';
import { ClassifierProvider } from '../src/requests/classifier-provider';
import { CustomerRequest } from '../src/requests/customer-request.entity';

/** In-memory stand-ins so the service is tested without a database. */
function setup(opts: { existing?: Partial<CustomerRequest> | null; provider?: ClassifierProvider } = {}) {
  const saved: object[] = [];
  const request = opts.existing === null ? null : { id: 'r1', status: 'open', ...opts.existing };
  const em = {
    findOneBy: vi.fn(async () => request),
    create: vi.fn((_cls: unknown, data: object) => ({ ...data })),
    save: vi.fn(async (row: object) => {
      saved.push({ ...row });
      return row;
    }),
  };
  const dataSource = { transaction: vi.fn(async (cb: (em: unknown) => Promise<void>) => cb(em)) };
  const provider: ClassifierProvider = opts.provider ?? {
    name: 'fake-v1',
    classify: async () => ({ category: 'billing', confidence: 0.86 }),
  };
  const events = { find: vi.fn(async () => []) };
  const service = new ClassificationService(provider, dataSource as never, events as never);
  return { service, em, saved, request, dataSource, events };
}

describe('ClassificationService.classify', () => {
  it('records an event without touching requests when no requestId is given', async () => {
    const { service, em, saved } = setup();
    const out = await service.classify('please refund my payment');

    expect(out).toEqual({ category: 'billing', confidence: 0.86, requestId: null });
    expect(em.findOneBy).not.toHaveBeenCalled();
    expect(saved).toEqual([
      {
        requestId: null,
        message: 'please refund my payment',
        category: 'billing',
        confidence: 0.86,
        provider: 'fake-v1',
      },
    ]);
  });

  it('updates the request, moves open -> in_progress, and records the event', async () => {
    const { service, request, saved } = setup();
    await service.classify('please refund my payment', 'r1');

    expect(request).toMatchObject({ category: 'billing', confidence: 0.86, status: 'in_progress' });
    expect(saved).toHaveLength(2);
    expect(saved[1]).toMatchObject({ requestId: 'r1', provider: 'fake-v1' });
  });

  it('does not reopen a resolved request', async () => {
    const { service, request } = setup({ existing: { status: 'resolved' } });
    await service.classify('please refund my payment', 'r1');
    expect(request?.status).toBe('resolved');
  });

  it('throws NotFound and writes no event for an unknown requestId', async () => {
    const { service, saved } = setup({ existing: null });
    await expect(service.classify('please refund my payment', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(saved).toHaveLength(0);
  });

  it('applies product rules to the provider verdict (short message softening)', async () => {
    const { service } = setup();
    const out = await service.classify('refund');
    expect(out.category).toBe('billing');
    expect(out.confidence).toBeCloseTo(0.71);
  });

  it('propagates provider failure before opening a transaction', async () => {
    const provider: ClassifierProvider = {
      name: 'llm-v0',
      classify: async () => {
        throw new Error('upstream timeout');
      },
    };
    const { service, dataSource } = setup({ provider });
    await expect(service.classify('anything at all')).rejects.toThrow('upstream timeout');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});

describe('ClassificationService.history', () => {
  it('filters by category, newest first, with a default limit', async () => {
    const { service, events } = setup();
    await service.history('billing');
    expect(events.find).toHaveBeenCalledWith({
      where: { category: 'billing' },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 50,
    });
  });

  it('applies no filter when category is omitted', async () => {
    const { service, events } = setup();
    await service.history(undefined, 10);
    expect(events.find).toHaveBeenCalledWith(expect.objectContaining({ where: {}, take: 10 }));
  });
});
