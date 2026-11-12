import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../users/entities/user.entity.js';
import { CreateCarModelDto } from './dto/create-car-model.dto.js';
import { CreateSpecificationDto } from './dto/create-specification.dto.js';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get('car-models')
  findCarModels() {
    return this.catalogService.findAllCarModels();
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Delete('car-models/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCarModel(@Param('id') id: string): Promise<void> {
    await this.catalogService.removeCarModel(id);
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Post('car-models')
  @HttpCode(HttpStatus.CREATED)
  createCarModel(@Body() dto: CreateCarModelDto) {
    return this.catalogService.createCarModel(dto);
  }

  @Public()
  @Get('specifications')
  findSpecifications() {
    return this.catalogService.findAllSpecifications();
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Post('specifications')
  @HttpCode(HttpStatus.CREATED)
  createSpecification(@Body() dto: CreateSpecificationDto) {
    return this.catalogService.createSpecification(dto);
  }
}
