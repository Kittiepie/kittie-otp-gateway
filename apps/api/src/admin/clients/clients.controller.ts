import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuarded } from '../admin-guarded.decorator';
import { ClientsService } from './clients.service';
import {
  ApiKeyDto,
  ClientDto,
  CreateClientDto,
  CreatedClientDto,
  CreatedKeyDto,
  UpdateClientDto,
} from './dto/client.dto';

@ApiTags('admin: clients')
@AdminGuarded()
@Controller('admin/clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(): Promise<ClientDto[]> {
    return this.clients.list();
  }

  @Post()
  create(@Body() dto: CreateClientDto): Promise<CreatedClientDto> {
    return this.clients.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ClientDto> {
    return this.clients.get(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto): Promise<ClientDto> {
    return this.clients.update(id, dto);
  }

  @Delete(':id')
  revoke(@Param('id', ParseUUIDPipe) id: string): Promise<ClientDto> {
    return this.clients.revoke(id);
  }

  @Post(':id/keys')
  createKey(@Param('id', ParseUUIDPipe) id: string): Promise<CreatedKeyDto> {
    return this.clients.createKey(id);
  }

  @Delete(':id/keys/:keyId')
  revokeKey(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('keyId', ParseUUIDPipe) keyId: string,
  ): Promise<ApiKeyDto> {
    return this.clients.revokeKey(id, keyId);
  }
}
