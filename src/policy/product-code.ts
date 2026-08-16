import { LoanType } from '../database/enums/loan-type.enum';

/**
 * Maps the M2 domain's `LoanType` (Section 6.1's target vocabulary) to the
 * policy DSL's `applicability.product` vocabulary (Section 10.7's example
 * uses "CONVENTIONAL_MORTGAGE", not the bare enum value "CONVENTIONAL") —
 * the two are the same concept in different namespaces, not the same
 * string, so this mapping is explicit rather than assumed.
 */
const PRODUCT_CODES: Record<LoanType, string> = {
  [LoanType.CONVENTIONAL]: 'CONVENTIONAL_MORTGAGE',
  [LoanType.FHA]: 'FHA_MORTGAGE',
  [LoanType.VA]: 'VA_MORTGAGE',
  [LoanType.JUMBO]: 'JUMBO_MORTGAGE',
};

export function loanTypeToProductCode(loanType: LoanType): string {
  return PRODUCT_CODES[loanType];
}
