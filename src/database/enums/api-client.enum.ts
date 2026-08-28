/** Section 20 M5 scope: "OIDC and scoped API-client authentication." A revoked client fails every subsequent request closed — its row is kept (audit history), not deleted. */
export enum ApiClientStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

/**
 * Section 20 M5 scope's "RBAC" line (M5-017). Exactly two roles, both
 * grounded directly in the charter's own language rather than invented:
 * `REVIEWER` is Section 6.3's own explicitly named authority ("Human
 * reviewers approve protected communications, interpret out-of-policy
 * cases, and record overrides") — the one role the charter itself
 * distinguishes anywhere in this API surface. `PARTNER` is everything
 * else a routine integration needs (case creation, evidence submission,
 * consent grant/revoke on a borrower's own behalf, webhook registration)
 * — deliberately not split further into a third "admin" tier with no
 * equivalent charter grounding to justify it.
 *
 * Shared by both credential models this codebase has (M5-024):
 * `ApiClient.role` for machine credentials and `TenantMembership.role`
 * for OIDC-linked human ones — a `PARTNER`/`REVIEWER` distinction means
 * the same real thing regardless of which authenticated the request
 * (`RoleGuard` reads `AuthContext.role` uniformly either way), so a
 * second, parallel role enum would be unbacked duplication, not honesty.
 */
export enum ApiClientRole {
  PARTNER = 'PARTNER',
  REVIEWER = 'REVIEWER',
}
