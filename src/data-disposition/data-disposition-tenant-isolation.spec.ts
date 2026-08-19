import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DataDispositionTask } from '../database/entities/data-disposition-task.entity';
import {
  DataDispositionTaskStatus,
  DataDispositionTaskType,
} from '../database/enums/data-disposition.enum';
import {
  runInTenantContext,
  runWithRlsBypass,
} from '../database/tenant-context';

// Requires a reachable Postgres with the DataDispositionTasks and
// AppRuntimeRole migrations applied: skip instead of failing when no
// DATABASE_URL is configured — same convention as every other real-DB
// spec in this codebase.
//
// M5-015's proof, same pattern as consent-tenant-isolation.spec.ts
// (M5-005): connects as the real `mortgage_app` role (M5-003), not
// DATABASE_URL's own, since a superuser connection would pass every one
// of these assertions trivially by bypassing RLS entirely. `data_
// disposition_tasks` is a genuinely new table with its own `tenantId`
// column, RLS applied in the same migration that created it.
const DATABASE_URL = process.env.DATABASE_URL;
const describeOrSkip = DATABASE_URL ? describe : describe.skip;

const APP_ROLE = 'mortgage_app';
const APP_ROLE_PASSWORD =
  process.env.APP_DATABASE_ROLE_PASSWORD ?? 'mortgage_app_demo';

function withCredentials(url: string, user: string, password: string): string {
  const parsed = new URL(url);
  parsed.username = user;
  parsed.password = password;
  return parsed.toString();
}

describeOrSkip('data_disposition_tasks row-level security', () => {
  let restrictedDataSource: DataSource;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  let taskA: DataDispositionTask;
  let taskB: DataDispositionTask;

  beforeAll(async () => {
    restrictedDataSource = new DataSource({
      type: 'postgres',
      url: withCredentials(DATABASE_URL as string, APP_ROLE, APP_ROLE_PASSWORD),
      entities: [DataDispositionTask],
    });
    await restrictedDataSource.initialize();

    function makeTask(tenantId: string) {
      const repo = restrictedDataSource.getRepository(DataDispositionTask);
      return repo.create({
        tenantId,
        caseId: randomUUID(),
        taskType: DataDispositionTaskType.RETENTION_REVIEW,
        status: DataDispositionTaskStatus.PENDING,
        reason: 'tenant-isolation-spec',
        triggeringConsentRecordId: randomUUID(),
        affectedEvidenceFactIds: [],
        resolvedAt: null,
      });
    }

    taskA = await runInTenantContext(restrictedDataSource, tenantA, (manager) =>
      manager.getRepository(DataDispositionTask).save(makeTask(tenantA)),
    );
    taskB = await runInTenantContext(restrictedDataSource, tenantB, (manager) =>
      manager.getRepository(DataDispositionTask).save(makeTask(tenantB)),
    );
  });

  afterAll(async () => {
    if (restrictedDataSource?.isInitialized) {
      await runWithRlsBypass(restrictedDataSource, (manager) =>
        manager.getRepository(DataDispositionTask).delete([taskA.id, taskB.id]),
      );
      await restrictedDataSource.destroy();
    }
  });

  it('a query with no tenant context and no bypass sees zero rows, even though real rows exist', async () => {
    const tasks = await restrictedDataSource
      .getRepository(DataDispositionTask)
      .find();
    expect(tasks).toHaveLength(0);
  });

  it("tenant A's context sees only tenant A's task", async () => {
    const tasks = await runInTenantContext(
      restrictedDataSource,
      tenantA,
      (manager) => manager.getRepository(DataDispositionTask).find(),
    );
    expect(tasks.map((t) => t.id)).toEqual([taskA.id]);
  });

  it("tenant B's context sees only tenant B's task, never tenant A's", async () => {
    const tasks = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) => manager.getRepository(DataDispositionTask).find(),
    );
    expect(tasks.map((t) => t.id)).toEqual([taskB.id]);
  });

  it("a direct lookup by id for a different tenant's task returns nothing, even though the row exists", async () => {
    const found = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) =>
        manager.getRepository(DataDispositionTask).findOneBy({ id: taskA.id }),
    );
    expect(found).toBeNull();
  });

  it("an UPDATE against a different tenant's task affects zero rows rather than erroring or succeeding silently", async () => {
    const result = await runInTenantContext(
      restrictedDataSource,
      tenantB,
      (manager) =>
        manager
          .getRepository(DataDispositionTask)
          .update(
            { id: taskA.id },
            { status: DataDispositionTaskStatus.COMPLETED },
          ),
    );
    expect(result.affected).toBe(0);

    const stillPending = await runInTenantContext(
      restrictedDataSource,
      tenantA,
      (manager) =>
        manager.getRepository(DataDispositionTask).findOneByOrFail({
          id: taskA.id,
        }),
    );
    expect(stillPending.status).toBe('PENDING');
  });

  it('an INSERT whose row tenantId does not match the session tenant context is rejected by PostgreSQL itself', async () => {
    await expect(
      runInTenantContext(restrictedDataSource, tenantB, (manager) => {
        const repo = manager.getRepository(DataDispositionTask);
        return repo.save(
          repo.create({
            // Row claims tenant A while the session context says tenant B.
            tenantId: tenantA,
            caseId: randomUUID(),
            taskType: DataDispositionTaskType.RETENTION_REVIEW,
            status: DataDispositionTaskStatus.PENDING,
            reason: 'tenant-isolation-spec-insert',
            triggeringConsentRecordId: randomUUID(),
            affectedEvidenceFactIds: [],
            resolvedAt: null,
          }),
        );
      }),
    ).rejects.toThrow();
  });

  it("bypass mode sees every tenant's tasks at once — the one explicit, audited exception", async () => {
    const tasks = await runWithRlsBypass(restrictedDataSource, (manager) =>
      manager.getRepository(DataDispositionTask).find(),
    );
    const ids = tasks.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining([taskA.id, taskB.id]));
  });
});
