import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { RulesUnderwriterService } from './rules-underwriter.service';
import { OllamaUnderwriterService } from './ollama-underwriter.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [IntegrationsModule],
  providers: [AgentService, RulesUnderwriterService, OllamaUnderwriterService],
  exports: [AgentService],
})
export class AgentModule {}
