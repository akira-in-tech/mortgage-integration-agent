import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { PermissiblePurposeDecision } from '../database/entities/permissible-purpose-decision.entity';
import { ProviderCapability } from './types';
import { PermissiblePurposeService } from './permissible-purpose.service';

const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

describeOrSkip('PermissiblePurposeService', () => {
  let dataSource: DataSource;
  let service: PermissiblePurposeService;
  const tenantId = randomUUID();
  const context = {
    tenantId,
    caseId: randomUUID(),
    borrowerSubjectId: 'purpose-spec-borrower',
    capability: ProviderCapability.CREDIT,
    purposeCode: 'UNDERWRITING_EVIDENCE',
    permittedDataClasses: ['CREDIT'],
    mode: 'SIMULATOR' as const,
  };

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [PermissiblePurposeDecision],
    });
    await dataSource.initialize();
    service = new PermissiblePurposeService(dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource
        .getRepository(PermissiblePurposeDecision)
        .delete({ tenantId });
      await dataSource.destroy();
    }
  });

  it('authorizes only the exact synthetic borrower transaction and scope', async () => {
    const id = await service.issueSynthetic(context);
    await expect(service.validate(id, context)).resolves.toEqual({
      valid: true,
    });
    await expect(
      service.validate(id, { ...context, borrowerSubjectId: 'other-borrower' }),
    ).resolves.toEqual({
      valid: false,
      reason: expect.stringContaining('scope'),
    });
    await expect(
      service.validate(id, { ...context, mode: 'AUTHORIZED_SANDBOX' }),
    ).resolves.toEqual({
      valid: false,
      reason: expect.stringContaining('synthetic'),
    });
  });

  it('fails closed after the decision expires', async () => {
    const id = await service.issueSynthetic(context);
    await dataSource
      .getRepository(PermissiblePurposeDecision)
      .update({ id }, { expiresAt: new Date(Date.now() - 1000) });
    await expect(service.validate(id, context)).resolves.toEqual({
      valid: false,
      reason: expect.stringContaining('expired'),
    });
  });

  it('refuses to mint synthetic authority for a live provider mode', async () => {
    await expect(
      service.issueSynthetic({ ...context, mode: 'AUTHORIZED_SANDBOX' }),
    ).rejects.toThrow(/simulator-credit only/);
  });
});
