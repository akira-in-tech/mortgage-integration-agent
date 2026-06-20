import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoanApplication } from './entities/loan-application.entity';

/**
 * DatabaseModule registers all entities and can be used as a central place
 * to add database health checks, migrations runner, or seeding logic.
 */
@Module({
  imports: [TypeOrmModule.forFeature([LoanApplication])],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
