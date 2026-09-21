import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClassificationService } from './classification.service';
import {
  ClassifyDto,
  CreateRequestDto,
  HistoryQueryDto,
  UpdateStatusDto,
} from './dto/requests.dto';
import { RequestsService } from './requests.service';

@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly classificationService: ClassificationService,
  ) {}

  @Get()
  list() {
    return this.requestsService.list();
  }

  @Get('history')
  async history(@Query() query: HistoryQueryDto) {
    return { items: await this.classificationService.history(query.category, query.limit) };
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.requestsService.getById(id);
  }

  @Post()
  create(@Body() body: CreateRequestDto) {
    return this.requestsService.create(body.message);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateStatusDto) {
    return this.requestsService.updateStatus(id, body.status);
  }

  @Post('classify')
  classify(@Body() body: ClassifyDto) {
    return this.classificationService.classify(body.message, body.requestId);
  }
}
