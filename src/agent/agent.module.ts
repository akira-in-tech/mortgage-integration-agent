import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [IntegrationsModule],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
