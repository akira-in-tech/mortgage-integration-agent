import { ApiClientRole } from '../database/enums/api-client.enum';

/** Attached to the request object by `ApiKeyGuard`; read by `AuthTenantId()`/`RoleGuard`. */
export interface AuthContext {
  tenantId: string;
  apiClientId: string;
  role: ApiClientRole;
}
