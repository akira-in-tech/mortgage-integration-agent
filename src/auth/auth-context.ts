import { ApiClientRole } from '../database/enums/api-client.enum';

/** Attached to the request object by `ApiKeyGuard`; read by `AuthTenantId()`/`CurrentAuth()`/`RoleGuard`. `correlationId` (M5-019) is a fresh id per authenticated request — the trace unit `audit_events` rows reference; there is no distributed tracing system to integrate with instead. */
export interface AuthContext {
  tenantId: string;
  apiClientId: string;
  role: ApiClientRole;
  correlationId: string;
}
