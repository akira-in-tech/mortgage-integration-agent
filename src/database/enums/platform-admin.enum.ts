/**
 * A platform administrator is a person who can act across every tenant at
 * once — the opposite of `ApiClientRole`, which only ever means something
 * within one tenant. Right now the only thing this credential can do is
 * drive the provider promotion chain (Section 11.4: propose, certify,
 * approve, activate a provider adapter for the whole platform), which has
 * no tenant to belong to in the first place.
 *
 * A revoked admin's row is kept, not deleted, matching `ApiClientStatus`'s
 * own precedent — every past decision they made stays attributable.
 */
export enum PlatformAdminStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}
