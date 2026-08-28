// A second, deliberately separate REST helper from api-client.ts. That
// one always attaches tenant headers (OIDC tenant id/CSRF or a tenant
// bearer token) because every route it talks to is tenant-scoped. The
// provider-promotion routes are the opposite — platform-wide, guarded by
// a platform-admin bearer token that has no tenant at all — so this
// helper sends only that token and nothing else, on purpose.
import { getStoredPlatformAdminToken } from './platform-admin-auth';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export async function platformAdminRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getStoredPlatformAdminToken();
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body) headers.set('content-type', 'application/json');

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    const message =
      typeof body?.message === 'string'
        ? body.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export interface ProviderPromotionManifest {
  id: string;
  providerId: string;
  capability: string;
  mode: string;
  version: number;
  adapterVersion: string;
  endpointAllowlist: string[];
  dataClassifications: string[];
  contentHash: string;
  proposedBy: string;
  proposedAt: string;
  validFrom: string;
  validUntil: string | null;
}

export interface ProviderCertificationRecord {
  id: string;
  environment: string;
  certifiedBy: string;
  decision: 'PASSED' | 'FAILED' | 'REVOKED';
  evidenceRef: string;
  decidedAt: string;
  expiresAt: string | null;
}

export interface ProviderApprovalRecord {
  id: string;
  approvalRole: string;
  approvedBy: string;
  decision: 'APPROVED' | 'REJECTED' | 'REVOKED';
  decidedAt: string;
  expiresAt: string | null;
}

export interface ProviderActivation {
  id: string;
  providerId: string;
  capability: string;
  mode: string;
  manifestId: string;
  manifestVersion: number;
  state: 'ACTIVE' | 'DEACTIVATED';
  activatedBy: string;
  activatedAt: string;
}

export interface ProviderPromotionManifestDetail {
  manifest: ProviderPromotionManifest;
  certifications: ProviderCertificationRecord[];
  approvals: ProviderApprovalRecord[];
  currentActivation: ProviderActivation | null;
}

export function listManifests(): Promise<ProviderPromotionManifest[]> {
  return platformAdminRequest(
    '/v1/platform-admin/provider-promotions/manifests',
  );
}

export function getManifestDetail(
  manifestId: string,
): Promise<ProviderPromotionManifestDetail> {
  return platformAdminRequest(
    `/v1/platform-admin/provider-promotions/manifests/${manifestId}`,
  );
}

export function proposeManifest(input: {
  providerId: string;
  capability: string;
  mode: string;
  adapterVersion: string;
  endpointAllowlist: string[];
  dataClassifications: string[];
  validUntil?: string;
}): Promise<ProviderPromotionManifest> {
  return platformAdminRequest(
    '/v1/platform-admin/provider-promotions/manifests',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function certifyManifest(
  manifestId: string,
  input: {
    environment: string;
    decision: 'PASSED' | 'FAILED' | 'REVOKED';
    evidenceRef: string;
    expiresAt?: string;
  },
): Promise<ProviderCertificationRecord> {
  return platformAdminRequest(
    `/v1/platform-admin/provider-promotions/manifests/${manifestId}/certifications`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function approveManifest(
  manifestId: string,
  input: {
    approvalRole: string;
    decision: 'APPROVED' | 'REJECTED' | 'REVOKED';
    expiresAt?: string;
  },
): Promise<ProviderApprovalRecord> {
  return platformAdminRequest(
    `/v1/platform-admin/provider-promotions/manifests/${manifestId}/approvals`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function activateManifest(
  manifestId: string,
  input: { environment: string; expectedCurrentManifestVersion: number | null },
): Promise<ProviderActivation> {
  return platformAdminRequest(
    `/v1/platform-admin/provider-promotions/manifests/${manifestId}/activate`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function listActivations(): Promise<ProviderActivation[]> {
  return platformAdminRequest(
    '/v1/platform-admin/provider-promotions/activations',
  );
}

export function deactivateProvider(input: {
  providerId: string;
  capability: string;
  mode: string;
}): Promise<ProviderActivation> {
  return platformAdminRequest(
    '/v1/platform-admin/provider-promotions/deactivate',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}
