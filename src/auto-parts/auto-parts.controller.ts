import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { RequestIdService } from '../shared/request-id.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../users/entities/user.entity.js';
import { AutoPartsService } from './auto-parts.service.js';
import { CompatibilityCodeDto } from './dto/create-auto-part-transactional.dto.js';
import { CreateAutoPartDto } from './dto/create-auto-part.dto.js';
import { CreateAutoPartTransactionalDto } from './dto/create-auto-part-transactional.dto.js';
import { PaginationQueryDto } from './dto/pagination-query.dto.js';
import { UpdateAutoPartDto } from './dto/update-auto-part.dto.js';
import { UpdateAutoPartTransactionalDto } from './dto/update-auto-part-transactional.dto.js';

@Controller('auto-parts')
export class AutoPartsController {
  private readonly logger = new Logger(AutoPartsController.name);

  constructor(
    private readonly autoPartsService: AutoPartsService,
    private readonly requestIdService: RequestIdService,
  ) {}

  private logRequest(method: string): void {
    this.logger.log(`${method} requestId=${this.requestIdService.getId()}`);
  }

  @Public()
  @Get()
  @Header('X-API-Version', '1.0')
  @Header('X-Service-Status', 'operational')
  findAll(@Query() query: PaginationQueryDto) {
    this.logRequest('GET /auto-parts');
    return this.autoPartsService.findAll(query);
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Post('transactional')
  @HttpCode(HttpStatus.CREATED)
  createTransactional(@Body() dto: CreateAutoPartTransactionalDto) {
    this.logRequest('POST /auto-parts/transactional');
    return this.autoPartsService.createTransactional(dto);
  }

  @Public()
  @Get(':id/aggregate')
  findAggregate(@Param('id') id: string) {
    return this.autoPartsService.findAggregate(id);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.autoPartsService.findOne(id);
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createAutoPartDto: CreateAutoPartDto) {
    this.logRequest('POST /auto-parts');
    return this.autoPartsService.create(createAutoPartDto);
  }

  /**
   * Додавання або оновлення 1:1-коду сумісності.
   * Привілейована операція варіанта 7: MECHANIC та ADMIN.
   */
  @Roles(Role.Admin, Role.Mechanic)
  @Post(':id/compatibility-code')
  upsertCompatibilityCode(
    @Param('id') id: string,
    @Body() dto: CompatibilityCodeDto,
  ) {
    this.logRequest('POST /auto-parts/:id/compatibility-code');
    return this.autoPartsService.upsertCompatibilityCode(id, dto);
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.autoPartsService.restore(id);
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Put(':id/transactional')
  updateTransactional(
    @Param('id') id: string,
    @Body() dto: UpdateAutoPartTransactionalDto,
  ) {
    this.logRequest('PUT /auto-parts/:id/transactional');
    return this.autoPartsService.updateTransactional(id, dto);
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAutoPartDto: UpdateAutoPartDto,
  ) {
    return this.autoPartsService.update(id, updateAutoPartDto);
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.autoPartsService.remove(id);
  }
}
