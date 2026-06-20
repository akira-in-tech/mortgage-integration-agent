export interface DocumentVerificationResult {
  /** IRS W-2 wage statement — required for salaried borrowers */
  w2Valid: boolean;
  /** Most recent 30-day pay stubs — required for employed borrowers */
  payStubValid: boolean;
  /** Two months of bank statements — AUS / manual underwrite requirement */
  bankStatementValid: boolean;
  /** Two years of federal tax returns — required for self-employed / large assets */
  taxReturnValid: boolean;
  /** Overall pass/fail — true only when all required docs are valid for the loan program */
  allDocumentsValid: boolean;
  /** List of document types with issues, empty when allDocumentsValid is true */
  failedDocuments: string[];
}
