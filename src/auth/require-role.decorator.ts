import { SetMetadata } from '@nestjs/common';
import { ApiClientRole } from '../database/enums/api-client.enum';

export const REQUIRED_ROLES_KEY = 'requiredRoles';

/** Applied alongside `@UseGuards(RoleGuard)` on a route whose action Section 6.3 (or a similarly explicit charter authority line) reserves to a specific role — e.g. `@RequireRole(ApiClientRole.REVIEWER)` on `submitReview`. Absent on a route means `RoleGuard` allows every role through unchanged; `ApiKeyGuard`'s own tenant/credential check is unaffected either way. */
export const RequireRole = (...roles: ApiClientRole[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);
