import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassificationEvent } from './classification-event.entity';
import { ClassificationService } from './classification.service';
import { CLASSIFIER_PROVIDER } from './classifier-provider';
import { CustomerRequest } from './customer-request.entity';
import { KeywordClassifier } from './keyword-classifier';
import { RequestNote } from './request-note.entity';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerRequest, RequestNote, ClassificationEvent])],
  controllers: [RequestsController],
  providers: [
    RequestsService,
    ClassificationService,
    // Swap this binding (e.g. useClass: LlmClassifier) to change providers.
    { provide: CLASSIFIER_PROVIDER, useClass: KeywordClassifier },
  ],
})
export class RequestsModule {}
