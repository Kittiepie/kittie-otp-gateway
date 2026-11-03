import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuarded } from '../admin-guarded.decorator';
import { LogsPageDto, LogsQueryDto, OtpLogDto } from './dto/logs-query.dto';
import { LogsService } from './logs.service';

@ApiTags('admin: logs')
@AdminGuarded()
@Controller('admin/logs')
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Get()
  list(@Query() query: LogsQueryDto): Promise<LogsPageDto> {
    return this.logs.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<OtpLogDto> {
    return this.logs.get(id);
  }
}
