/** Section 20 M5 scope: "OIDC and scoped API-client authentication." A revoked client fails every subsequent request closed — its row is kept (audit history), not deleted. */
export enum ApiClientStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}
