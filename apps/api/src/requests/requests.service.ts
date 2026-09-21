import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerRequest, RequestStatus } from './customer-request.entity';
import { RequestNote } from './request-note.entity';

export type RequestListItem = {
  id: string;
  message: string;
  status: RequestStatus;
  category: string | null;
  confidence: number | null;
  noteCount: number;
  latestNotePreview: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(CustomerRequest)
    private readonly requests: Repository<CustomerRequest>,
  ) {}

  /**
   * One round trip regardless of row count. Note count and latest note are
   * correlated subqueries served by idx_request_notes_request_id_created, so we
   * never load the notes themselves.
   */
  async list(): Promise<RequestListItem[]> {
    const { entities, raw } = await this.requests
      .createQueryBuilder('r')
      .addSelect(
        (qb) =>
          qb
            .select('COUNT(*)::int')
            .from(RequestNote, 'n')
            .where('n.request_id = r.id'),
        'note_count',
      )
      .addSelect(
        (qb) =>
          qb
            .select('n.body')
            .from(RequestNote, 'n')
            .where('n.request_id = r.id')
            .orderBy('n.created_at', 'DESC')
            .addOrderBy('n.id', 'DESC')
            .limit(1),
        'latest_note_body',
      )
      .orderBy('r.created_at', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .getRawAndEntities();

    // getRawAndEntities preserves row order 1:1 when there are no joins.
    return entities.map((row, i) => ({
      id: row.id,
      message: row.message,
      status: row.status,
      category: row.category,
      confidence: row.confidence,
      noteCount: raw[i].note_count,
      latestNotePreview: raw[i].latest_note_body ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getById(id: string): Promise<CustomerRequest> {
    const row = await this.requests.findOne({
      where: { id },
      relations: { notes: true },
    });
    if (!row) {
      throw new NotFoundException(`Request ${id} not found`);
    }
    return row;
  }

  async updateStatus(id: string, status: RequestStatus): Promise<CustomerRequest> {
    const row = await this.getById(id);
    row.status = status;
    return this.requests.save(row);
  }

  async create(message: string): Promise<CustomerRequest> {
    const row = this.requests.create({
      message,
      status: 'open',
      category: null,
      confidence: null,
    });
    return this.requests.save(row);
  }
}
