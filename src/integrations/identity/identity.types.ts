export interface IdentityVerificationResult {
  /** Stated name matches the identity record on file */
  nameMatch: boolean;
  /** Stated date of birth matches the identity record on file */
  dateOfBirthMatch: boolean;
  /** SSN format and issuance-range validity check (not a credit-bureau pull — that's CreditService) */
  ssnValid: boolean;
  /** Stated address matches the identity record on file */
  addressMatch: boolean;
  /** A fraud/synthetic-identity alert exists on file for this identity */
  fraudAlertPresent: boolean;
  /** Overall pass/fail: true only when every check above passes and no fraud alert is present */
  identityVerified: boolean;
}
