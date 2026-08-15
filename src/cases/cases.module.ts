import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { LoanCase } from '../database/entities/loan-case.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { TemporalModule } from '../workflows/temporal.module';

@Module({
  imports: [TypeOrmModule.forFeature([LoanCase, Tenant]), TemporalModule],
  controllers: [CasesController],
  providers: [CasesService],
})
export class CasesModule {}
