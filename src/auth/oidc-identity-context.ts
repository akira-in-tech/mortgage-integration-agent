/**
 * A verified human identity before a tenant has been selected. This context
 * is intentionally narrower than `AuthContext`: it carries no tenant or role
 * and therefore cannot authorize any case, policy, provider, or audit action.
 * Its only caller is the self-service tenant-membership discovery endpoint.
 */
export interface OidcIdentityContext {
  userId: string;
  subject: string;
  email: string;
}
