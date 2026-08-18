import { Module } from '@nestjs/common';
import { PlaidService } from './plaid/plaid.service';
import { CreditService } from './credit/credit.service';
import { DocumentService } from './document/document.service';
import { PlaidIncomeAdapter } from './plaid/plaid-income.adapter';
import { ProviderAdapterBootstrapService } from './provider-adapter-bootstrap.service';
import { ProviderPlatformModule } from '../provider-platform/provider-platform.module';

@Module({
  imports: [ProviderPlatformModule],
  providers: [
    PlaidService,
    CreditService,
    DocumentService,
    PlaidIncomeAdapter,
    ProviderAdapterBootstrapService,
  ],
  exports: [
    PlaidService,
    CreditService,
    DocumentService,
    ProviderPlatformModule,
  ],
})
export class IntegrationsModule {}
