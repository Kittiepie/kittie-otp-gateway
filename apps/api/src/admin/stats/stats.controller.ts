import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminGuarded } from '../admin-guarded.decorator';
import { StatsDto, StatsService } from './stats.service';

@ApiTags('admin: stats')
@AdminGuarded()
@Controller('admin/stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  @ApiQuery({ name: 'days', required: false, description: '1-90, default 14' })
  get(@Query('days', new DefaultValuePipe(14), ParseIntPipe) days: number): Promise<StatsDto> {
    return this.stats.daily(Math.min(Math.max(days, 1), 90));
  }
}
