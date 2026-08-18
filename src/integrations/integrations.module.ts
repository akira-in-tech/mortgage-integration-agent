import { Module } from '@nestjs/common';
import { PlaidService } from './plaid/plaid.service';
import { CreditService } from './credit/credit.service';
import { DocumentService } from './document/document.service';
import { AssetService } from './asset/asset.service';
import { IdentityService } from './identity/identity.service';
import { PlaidIncomeAdapter } from './plaid/plaid-income.adapter';
import { CreditReportAdapter } from './credit/credit-report.adapter';
import { DocumentVerificationAdapter } from './document/document-verification.adapter';
import { AssetVerificationAdapter } from './asset/asset-verification.adapter';
import { IdentityVerificationAdapter } from './identity/identity-verification.adapter';
import { ProviderAdapterBootstrapService } from './provider-adapter-bootstrap.service';
import { ProviderPlatformModule } from '../provider-platform/provider-platform.module';

@Module({
  imports: [ProviderPlatformModule],
  providers: [
    PlaidService,
    CreditService,
    DocumentService,
    AssetService,
    IdentityService,
    PlaidIncomeAdapter,
    CreditReportAdapter,
    DocumentVerificationAdapter,
    AssetVerificationAdapter,
    IdentityVerificationAdapter,
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
