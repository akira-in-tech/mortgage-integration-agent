import { Module } from '@nestjs/common';
import { PlaidService } from './plaid/plaid.service';
import { CreditService } from './credit/credit.service';
import { DocumentService } from './document/document.service';

@Module({
  providers: [PlaidService, CreditService, DocumentService],
  exports: [PlaidService, CreditService, DocumentService],
})
export class IntegrationsModule {}
