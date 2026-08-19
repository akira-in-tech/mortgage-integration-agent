/** Section 20 M5 scope: "OIDC and scoped API-client authentication." A revoked client fails every subsequent request closed — its row is kept (audit history), not deleted. */
export enum ApiClientStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

/**
 * Section 20 M5 scope's "RBAC" line, scoped to what this codebase's
 * actual credential model (machine `api_clients`, not OIDC-linked human
 * `users`/`tenant_memberships` — neither exists) can honestly support
 * (M5-017). Exactly two roles, both grounded directly in the charter's
 * own language rather than invented: `REVIEWER` is Section 6.3's own
 * explicitly named authority ("Human reviewers approve protected
 * communications, interpret out-of-policy cases, and record overrides")
 * — the one role the charter itself distinguishes anywhere in this API
 * surface. `PARTNER` is everything else a routine integration needs
 * (case creation, evidence submission, consent grant/revoke on a
 * borrower's own behalf, webhook registration) — deliberately not split
 * further into a third "admin" tier with no equivalent charter grounding
 * to justify it.
 */
export enum ApiClientRole {
  PARTNER = 'PARTNER',
  REVIEWER = 'REVIEWER',
}
