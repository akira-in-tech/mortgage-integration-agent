import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Jurisdiction } from '../database/entities/jurisdiction.entity';
import { PolicySource } from '../database/entities/policy-source.entity';
import { PolicySourceRevision } from '../database/entities/policy-source-revision.entity';
import {
  JurisdictionLevel,
  JurisdictionCoverageStatus,
} from '../database/enums/jurisdiction.enum';
import { PolicySourceRetrievalMode } from '../database/enums/policy-source.enum';
import { PolicySourceMonitorService } from './policy-source-monitor.service';
import { DemoPolicySourceConnector } from './policy-source-connector';

const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const JURISDICTION_CODE = 'US-PSM-TEST';

describeOrSkip('PolicySourceMonitorService (Charter Section 29 item 4)', () => {
  let dataSource: DataSource;
  let service: PolicySourceMonitorService;
  let sourceId: string;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: DATABASE_URL,
      entities: [Jurisdiction, PolicySource, PolicySourceRevision],
    });
    await dataSource.initialize();
    service = new PolicySourceMonitorService(
      dataSource.getRepository(PolicySource),
      dataSource.getRepository(PolicySourceRevision),
    );

    await dataSource.getRepository(Jurisdiction).save(
      dataSource.getRepository(Jurisdiction).create({
        code: JURISDICTION_CODE,
        level: JurisdictionLevel.STATE,
        parentCode: null,
        name: 'Policy source monitor spec jurisdiction',
        coverageStatus: JurisdictionCoverageStatus.NOT_COVERED,
      }),
    );

    const source = await dataSource.getRepository(PolicySource).save(
      dataSource.getRepository(PolicySource).create({
        name: 'Policy source monitor spec source',
        owner: 'policy-team',
        jurisdictionCode: JURISDICTION_CODE,
        retrievalMode: PolicySourceRetrievalMode.CONNECTOR,
        freshnessObjectiveHours: 24,
      }),
    );
    sourceId = source.id;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource
        .getRepository(PolicySourceRevision)
        .delete({ policySourceId: sourceId });
      await dataSource.getRepository(PolicySource).delete({ id: sourceId });
      await dataSource
        .getRepository(Jurisdiction)
        .delete({ code: JURISDICTION_CODE });
      await dataSource.destroy();
    }
  });

  it('records a real candidate revision the first time it sees new content, and does nothing on a second identical check', async () => {
    const connector = new DemoPolicySourceConnector(sourceId, async () => ({
      checksum: 'sha256:monitor-spec-v1',
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      content: { bulletinId: 'MONITOR-SPEC-1', summary: 'first check' },
    }));

    const first = await service.checkSource(connector);
    expect(first).toEqual({ sourceId, outcome: 'new_revision' });

    const revisions = await dataSource
      .getRepository(PolicySourceRevision)
      .find({ where: { policySourceId: sourceId } });
    expect(revisions).toHaveLength(1);
    expect(revisions[0].checksum).toBe('sha256:monitor-spec-v1');

    // Recording a revision never touches the jurisdiction's own reviewed
    // coverage status - Section 10.6's decoupling stays real, not just
    // documented.
    const jurisdiction = await dataSource
      .getRepository(Jurisdiction)
      .findOneByOrFail({ code: JURISDICTION_CODE });
    expect(jurisdiction.coverageStatus).toBe(
      JurisdictionCoverageStatus.NOT_COVERED,
    );

    const second = await service.checkSource(connector);
    expect(second).toEqual({ sourceId, outcome: 'no_change' });
    const revisionsAfterSecondCheck = await dataSource
      .getRepository(PolicySourceRevision)
      .find({ where: { policySourceId: sourceId } });
    expect(revisionsAfterSecondCheck).toHaveLength(1);
  });

  it('detects a real content change and records a second real revision', async () => {
    let call = 0;
    const connector = new DemoPolicySourceConnector(sourceId, async () => {
      call += 1;
      return {
        checksum: `sha256:monitor-spec-change-${call}`,
        publishedAt: new Date(),
        content: {
          bulletinId: `MONITOR-SPEC-CHANGE-${call}`,
          summary: 'changed content',
        },
      };
    });

    const before = await dataSource
      .getRepository(PolicySourceRevision)
      .find({ where: { policySourceId: sourceId } });

    const result = await service.checkSource(connector);
    expect(result.outcome).toBe('new_revision');

    const after = await dataSource
      .getRepository(PolicySourceRevision)
      .find({ where: { policySourceId: sourceId } });
    expect(after.length).toBe(before.length + 1);
  });

  it('flags schema drift and writes no revision when the connector returns content missing the expected shape', async () => {
    const before = await dataSource
      .getRepository(PolicySourceRevision)
      .find({ where: { policySourceId: sourceId } });

    const driftingConnector = new DemoPolicySourceConnector(
      sourceId,
      async () => ({
        checksum: 'sha256:monitor-spec-drift',
        publishedAt: new Date(),
        // No `summary` field - not the shape any real revision in this
        // codebase has ever had.
        content: { bulletinId: 'MONITOR-SPEC-DRIFT' },
      }),
    );

    const result = await service.checkSource(driftingConnector);
    expect(result.outcome).toBe('schema_drift');
    expect(result.detail).toContain('summary');

    const after = await dataSource
      .getRepository(PolicySourceRevision)
      .find({ where: { policySourceId: sourceId } });
    expect(after).toHaveLength(before.length);
  });

  it('refuses to poll a source that is not in CONNECTOR mode', async () => {
    const manualSource = await dataSource.getRepository(PolicySource).save(
      dataSource.getRepository(PolicySource).create({
        name: 'Policy source monitor spec manual source',
        owner: 'policy-team',
        jurisdictionCode: JURISDICTION_CODE,
        retrievalMode: PolicySourceRetrievalMode.MANUAL,
        freshnessObjectiveHours: 24,
      }),
    );
    try {
      const connector = new DemoPolicySourceConnector(
        manualSource.id,
        async () => ({
          checksum: 'sha256:should-never-be-read',
          publishedAt: new Date(),
          content: { bulletinId: 'SHOULD-NOT-RUN', summary: 'x' },
        }),
      );
      const result = await service.checkSource(connector);
      expect(result.outcome).toBe('error');
      expect(result.detail).toContain('CONNECTOR');
    } finally {
      await dataSource
        .getRepository(PolicySource)
        .delete({ id: manualSource.id });
    }
  });
});
