/** Attached to the request object by `ApiKeyGuard`; read by `AuthTenantId()`. */
export interface AuthContext {
  tenantId: string;
  apiClientId: string;
}
