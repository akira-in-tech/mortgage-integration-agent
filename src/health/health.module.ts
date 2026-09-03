import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { TemporalModule } from '../workflows/temporal.module';

@Module({
  imports: [TemporalModule],
  controllers: [HealthController],
})
export class HealthModule {}
