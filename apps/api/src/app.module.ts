import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestsModule } from './requests/requests.module';
import { CustomerRequest } from './requests/customer-request.entity';
import { RequestNote } from './requests/request-note.entity';
import { ClassificationEvent } from './requests/classification-event.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL ?? 'postgres://cami:cami@localhost:5432/cami',
      entities: [CustomerRequest, RequestNote, ClassificationEvent],
      synchronize: false,
      // Per-query logging is opt-in: it drowns real signal (and hid the N+1).
      logging: process.env.TYPEORM_LOG_QUERIES === 'true' ? ['query', 'error'] : ['error'],
    }),
    RequestsModule,
  ],
})
export class AppModule {}
