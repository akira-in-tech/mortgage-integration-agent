import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProviderPromotionService } from './provider-promotion.service';
import { ProviderPromotionController } from './provider-promotion.controller';
import { ProviderCapability } from './types';
import {
  ProviderApprovalDecision,
  ProviderCertificationDecision,
} from '../database/enums/provider-promotion.enum';

const ADMIN = {
  adminId: '11111111-1111-1111-1111-111111111111',
  adminName: 'platform-admin-1',
  correlationId: '22222222-2222-2222-2222-222222222222',
};
const MANIFEST_ID = '33333333-3333-3333-3333-333333333333';

const MANIFEST = {
  id: MANIFEST_ID,
  providerId: 'plaid-sandbox',
  capability: ProviderCapability.INCOME,
  mode: 'AUTHORIZED_SANDBOX',
  version: 1,
  adapterVersion: '1.0.0',
  endpointAllowlist: ['https://sandbox.plaid.com'],
  dataClassifications: ['INCOME'],
  contentHash: 'a'.repeat(64),
  proposedBy: 'someone-else',
  proposedAt: new Date('2026-01-01T00:00:00Z'),
  validFrom: new Date('2026-01-01T00:00:00Z'),
  validUntil: null,
};

describe('ProviderPromotionController', () => {
  let promotionService: {
    listManifests: jest.Mock;
    getManifest: jest.Mock;
    listCertifications: jest.Mock;
    listApprovals: jest.Mock;
    getActivation: jest.Mock;
    listActivations: jest.Mock;
    propose: jest.Mock;
    certify: jest.Mock;
    approve: jest.Mock;
    activate: jest.Mock;
    deactivate: jest.Mock;
  };
  let controller: ProviderPromotionController;

  beforeEach(() => {
    promotionService = {
      listManifests: jest.fn().mockResolvedValue([MANIFEST]),
      getManifest: jest.fn().mockResolvedValue(MANIFEST),
      listCertifications: jest.fn().mockResolvedValue([]),
      listApprovals: jest.fn().mockResolvedValue([]),
      getActivation: jest.fn().mockResolvedValue(null),
      listActivations: jest.fn().mockResolvedValue([]),
      propose: jest.fn().mockResolvedValue(MANIFEST),
      certify: jest.fn(),
      approve: jest.fn(),
      activate: jest.fn(),
      deactivate: jest.fn(),
    };
    controller = new ProviderPromotionController(
      promotionService as unknown as ProviderPromotionService,
    );
  });

  it('proposes a manifest with proposedBy taken from the authenticated admin, never the request body', async () => {
    const result = await controller.propose(ADMIN, {
      providerId: 'plaid-sandbox',
      capability: ProviderCapability.INCOME,
      mode: 'AUTHORIZED_SANDBOX',
      adapterVersion: '1.0.0',
      endpointAllowlist: ['https://sandbox.plaid.com'],
      dataClassifications: ['INCOME'],
    });

    expect(promotionService.propose).toHaveBeenCalledWith(
      expect.objectContaining({ proposedBy: ADMIN.adminName }),
    );
    expect(result.id).toBe(MANIFEST_ID);
  });

  it('getManifestDetail() combines the manifest, its certification/approval history, and its current activation into one response', async () => {
    promotionService.listCertifications.mockResolvedValue([
      {
        id: 'cert-1',
        environment: 'sandbox',
        certifiedBy: 'certifier-1',
        decision: ProviderCertificationDecision.PASSED,
        evidenceRef: 'evidence://1',
        decidedAt: new Date('2026-01-02T00:00:00Z'),
        expiresAt: null,
      },
    ]);
    promotionService.listApprovals.mockResolvedValue([
      {
        id: 'approval-1',
        approvalRole: 'compliance',
        approvedBy: 'approver-1',
        decision: ProviderApprovalDecision.APPROVED,
        decidedAt: new Date('2026-01-03T00:00:00Z'),
        expiresAt: null,
      },
    ]);
    promotionService.getActivation.mockResolvedValue({
      id: 'activation-1',
      providerId: 'plaid-sandbox',
      capability: ProviderCapability.INCOME,
      mode: 'AUTHORIZED_SANDBOX',
      manifestId: MANIFEST_ID,
      manifestVersion: 1,
      state: 'ACTIVE',
      activatedBy: 'activator-1',
      activatedAt: new Date('2026-01-04T00:00:00Z'),
    });

    const detail = await controller.getManifestDetail(MANIFEST_ID);

    expect(detail.manifest.id).toBe(MANIFEST_ID);
    expect(detail.certifications).toHaveLength(1);
    expect(detail.approvals).toHaveLength(1);
    expect(detail.currentActivation?.state).toBe('ACTIVE');
  });

  it('getManifestDetail() turns an unknown manifestId into a 404, not an unhandled error', async () => {
    promotionService.getManifest.mockRejectedValue(
      new Error(
        'Could not find any entity of type "ProviderPromotionManifest"',
      ),
    );

    await expect(
      controller.getManifestDetail(MANIFEST_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('certify() records the authenticated admin as certifiedBy', async () => {
    promotionService.certify.mockResolvedValue({
      id: 'cert-1',
      environment: 'sandbox',
      certifiedBy: ADMIN.adminName,
      decision: ProviderCertificationDecision.PASSED,
      evidenceRef: 'evidence://1',
      decidedAt: new Date('2026-01-02T00:00:00Z'),
      expiresAt: null,
    });

    await controller.certify(ADMIN, MANIFEST_ID, {
      environment: 'sandbox',
      decision: ProviderCertificationDecision.PASSED,
      evidenceRef: 'evidence://1',
    });

    expect(promotionService.certify).toHaveBeenCalledWith(
      MANIFEST_ID,
      'sandbox',
      ADMIN.adminName,
      ProviderCertificationDecision.PASSED,
      'evidence://1',
      null,
    );
  });

  it('activate() passes null (not undefined) for expectedCurrentManifestVersion when the body omits it', async () => {
    promotionService.activate.mockResolvedValue({
      id: 'activation-1',
      providerId: 'plaid-sandbox',
      capability: ProviderCapability.INCOME,
      mode: 'AUTHORIZED_SANDBOX',
      manifestId: MANIFEST_ID,
      manifestVersion: 1,
      state: 'ACTIVE',
      activatedBy: ADMIN.adminName,
      activatedAt: new Date('2026-01-04T00:00:00Z'),
    });

    await controller.activate(ADMIN, MANIFEST_ID, {
      environment: 'sandbox',
      expectedCurrentManifestVersion: null,
    });

    expect(promotionService.activate).toHaveBeenCalledWith(
      MANIFEST_ID,
      'sandbox',
      ADMIN.adminName,
      null,
    );
  });

  it("passes through the service's own BadRequestException (e.g. an unresolvable dual-control gate) unchanged", async () => {
    const gateError = new BadRequestException(
      'manifest has no current PASSED, unexpired certification',
    );
    promotionService.activate.mockRejectedValue(gateError);

    await expect(
      controller.activate(ADMIN, MANIFEST_ID, {
        environment: 'sandbox',
        expectedCurrentManifestVersion: null,
      }),
    ).rejects.toBe(gateError);
  });

  it('wraps an unexpected service error into a plain 400 instead of letting it become an unhandled 500', async () => {
    promotionService.approve.mockRejectedValue(new Error('database exploded'));

    await expect(
      controller.approve(ADMIN, MANIFEST_ID, {
        approvalRole: 'compliance',
        decision: ProviderApprovalDecision.APPROVED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deactivate() records the authenticated admin as the one who disabled it, and returns the real resulting row', async () => {
    promotionService.deactivate.mockResolvedValue({
      id: 'activation-1',
      providerId: 'plaid-sandbox',
      capability: ProviderCapability.INCOME,
      mode: 'AUTHORIZED_SANDBOX',
      manifestId: MANIFEST_ID,
      manifestVersion: 1,
      state: 'DEACTIVATED',
      activatedBy: ADMIN.adminName,
      activatedAt: new Date('2026-01-05T00:00:00Z'),
    });

    const result = await controller.deactivate(ADMIN, {
      providerId: 'plaid-sandbox',
      capability: ProviderCapability.INCOME,
      mode: 'AUTHORIZED_SANDBOX',
    });

    expect(promotionService.deactivate).toHaveBeenCalledWith(
      'plaid-sandbox',
      ProviderCapability.INCOME,
      'AUTHORIZED_SANDBOX',
      ADMIN.adminName,
    );
    expect(result.state).toBe('DEACTIVATED');
  });
});
