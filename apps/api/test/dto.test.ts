import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  ClassifyDto,
  CreateRequestDto,
  HistoryQueryDto,
  UpdateStatusDto,
} from '../src/requests/dto/requests.dto';

function check<T extends object>(cls: new () => T, plain: object) {
  const instance = plainToInstance(cls, plain);
  return { instance, errors: validateSync(instance, { whitelist: true, forbidNonWhitelisted: true }) };
}

describe('ClassifyDto', () => {
  it('trims the message', () => {
    const { instance, errors } = check(ClassifyDto, { message: '  refund me  ' });
    expect(errors).toHaveLength(0);
    expect(instance.message).toBe('refund me');
  });

  it.each([{}, { message: '' }, { message: '   ' }, { message: 42 }])('rejects %j', (body) => {
    expect(check(ClassifyDto, body).errors.length).toBeGreaterThan(0);
  });

  it('enforces the 2000 char limit after trimming', () => {
    expect(check(ClassifyDto, { message: 'a'.repeat(2000) }).errors).toHaveLength(0);
    expect(check(ClassifyDto, { message: 'a'.repeat(2001) }).errors.length).toBeGreaterThan(0);
    expect(check(ClassifyDto, { message: ` ${'a'.repeat(2000)} ` }).errors).toHaveLength(0);
  });

  it('requires requestId to be a uuid when present', () => {
    expect(check(ClassifyDto, { message: 'x', requestId: 'nope' }).errors.length).toBeGreaterThan(0);
    expect(
      check(ClassifyDto, { message: 'x', requestId: '3f2b8c1e-5a4d-4b7e-9c11-2d6f0a8e7b34' }).errors,
    ).toHaveLength(0);
  });
});

describe('CreateRequestDto', () => {
  it('rejects a missing message', () => {
    expect(check(CreateRequestDto, {}).errors.length).toBeGreaterThan(0);
  });
});

describe('UpdateStatusDto', () => {
  it('accepts known statuses only', () => {
    expect(check(UpdateStatusDto, { status: 'resolved' }).errors).toHaveLength(0);
    expect(check(UpdateStatusDto, { status: 'closed' }).errors.length).toBeGreaterThan(0);
    expect(check(UpdateStatusDto, {}).errors.length).toBeGreaterThan(0);
  });
});

describe('HistoryQueryDto', () => {
  it('allows no filters', () => {
    expect(check(HistoryQueryDto, {}).errors).toHaveLength(0);
  });

  it('validates category and coerces limit from the query string', () => {
    const { instance, errors } = check(HistoryQueryDto, { category: 'billing', limit: '25' });
    expect(errors).toHaveLength(0);
    expect(instance.limit).toBe(25);
  });

  it.each([{ category: 'bogus' }, { limit: '0' }, { limit: '1000' }, { limit: 'abc' }])(
    'rejects %j',
    (query) => {
      expect(check(HistoryQueryDto, query).errors.length).toBeGreaterThan(0);
    },
  );
});
