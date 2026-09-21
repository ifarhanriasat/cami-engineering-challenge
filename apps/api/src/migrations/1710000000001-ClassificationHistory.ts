import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClassificationHistory1710000000001 implements MigrationInterface {
  name = 'ClassificationHistory1710000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS classification_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id uuid NULL REFERENCES customer_requests(id) ON DELETE SET NULL,
        message text NOT NULL,
        category varchar(32) NOT NULL,
        confidence double precision NOT NULL,
        provider varchar(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // History list is "newest first, optionally one category".
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_classification_events_category_created
      ON classification_events(category, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_classification_events_created
      ON classification_events(created_at DESC);
    `);

    // Serves the per-request count and "latest note" lookups in GET /requests.
    // Supersedes the single-column idx_request_notes_request_id for these reads.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_request_notes_request_id_created
      ON request_notes(request_id, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_request_notes_request_id_created;`);
    await queryRunner.query(`DROP TABLE IF EXISTS classification_events;`);
  }
}
