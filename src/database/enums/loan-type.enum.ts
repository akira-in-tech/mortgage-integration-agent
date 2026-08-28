/**
 * Shared across the GraphQL layer (src/loan/loan.model.ts) and persistence
 * layer (loan-application.entity.ts, loan-case.entity.ts) so the same loan
 * program vocabulary can't drift between the API and the database.
 */
export enum LoanType {
  CONVENTIONAL = 'CONVENTIONAL',
  FHA = 'FHA',
  VA = 'VA',
  JUMBO = 'JUMBO',
}
