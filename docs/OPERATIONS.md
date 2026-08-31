# Operations and observability

This is the operator runbook for the implemented synthetic environment. It owns runtime telemetry, SLO measurement, alerts, and incident response; `README.md` remains the developer quickstart and `PROJECT_CHARTER.md` remains the normative product contract.

## Runtime topology

```text
API / Worker
  └─ OTLP/HTTP traces + metrics
       └─ OpenTelemetry Collector
            ├─ traces  → Tempo → Grafana Explore
            └─ metrics → Prometheus exporter → Prometheus → Grafana dashboard
```

The application depends only on the OTLP contract. Tempo, Prometheus, and Grafana are free local implementations and can be replaced by a managed or tenant-controlled backend without changing domain services. Export is fail-open: Collector loss must degrade observability, not approve, deny, send, order, or mutate a case.

## Start and verify locally

The profile is opt-in and every published port binds to loopback. It has no production authentication or high-availability guarantee and must not be exposed to an untrusted network.

```bash
OTEL_ENABLED=true docker compose --profile observability up -d

curl --fail http://127.0.0.1:13133/       # Collector
curl --fail http://127.0.0.1:9090/-/ready # Prometheus
curl --fail http://127.0.0.1:3200/ready   # Tempo
curl --fail http://127.0.0.1:3001/api/health
```

Grafana is available at <http://127.0.0.1:3001> with anonymous Viewer access. The provisioned `Lending Operations Reliability` dashboard uses the provisioned Prometheus and Tempo data sources. Stop the profile without deleting its named volumes with:

```bash
docker compose --profile observability stop grafana prometheus otel-collector tempo
```

Deleting the named volumes is intentionally not part of the runbook because it destroys local trace, metric, and dashboard state.

## Telemetry data boundary

Metrics use bounded labels only: domain enums, fixed operation names, registered Agent tools, boolean states, and bounded failure codes. Never add tenant, case, borrower, workflow, provider receipt, intent, ledger, reservation, endpoint, URL query, free text, or credential values as metric labels.

The telemetry pipeline removes or disables collection of:

- Temporal workflow, run, activity, and update identifiers;
- user identifiers, headers, cookies, authorization values, exception text, and stack traces;
- database namespaces, SQL parameters, raw SQL, and GraphQL documents;
- HTTP query strings and fragments;
- automatically detected host IDs, local user names, process paths, and command arguments.

Only the explicit service name is exported as a resource attribute. When adding instrumentation, extend the exporter-DLP tests and read a synthetic trace back from the target backend before accepting the change.

## Initial release objectives

These are targets from Charter Section 17.2, not claims about a deployed production service. A result is reportable only with the environment, load profile, observation window, sample size, and query artifact.

| Objective                                      |                Target | Implemented signal                                                           | Current evidence                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------- | --------------------: | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Synthetic staging API availability             |         99.9% monthly | HTTP server request count and `lending:slo:api_availability:ratio_5m`        | Not a monthly measurement, but one real data point exists (2026-08-29, `staging-drill.yml` `failure-recovery`): killing the one running api task produced a real ALB outage of 40s (t+26s to t+66s after the kill) before automatic recovery. See `docs/DEVELOPMENT_LOG.md`'s M7-025 entry.                                                                           |
| Non-workflow API latency                       |      p95 below 500 ms | HTTP request-duration histogram and `lending:slo:api_latency_p95_seconds:5m` | Real result, 2026-08-29 (`staging-drill.yml` `load`, k6, 20 VUs): overall p95 9.2ms, `/health/ready` (real DB round-trip per request) p95 9.6ms — well under target. Scope limit: only the two unauthenticated `/health/*` endpoints were load-tested, not the full non-workflow REST/GraphQL surface (that needs a synthetic authenticated tenant, a separate task). |
| Workflow-start acknowledgement                 |         p95 below 1 s | `lending_workflow_client_duration_seconds` with `operation=start`            | Load profile unexecuted — not covered by the health-endpoint-only load drill above                                                                                                                                                                                                                                                                                    |
| Provider retry/fallback duplicate effect       |                     0 | Durable intent/audit evidence; unknown-outcome metric and alert              | Release fault corpus required; not inferred from HTTP metrics                                                                                                                                                                                                                                                                                                         |
| Protected communication without approval       |                     0 | Durable communication/audit evidence                                         | Release corpus required                                                                                                                                                                                                                                                                                                                                               |
| Agent effect without budget/deadline authority |                     0 | Budget reservation transition/failure metrics plus durable ledger evidence   | Release corpus required                                                                                                                                                                                                                                                                                                                                               |
| Webhook delivery for healthy receivers         | 99.9% in retry window | Webhook attempt/terminal-failure metrics                                     | Healthy-receiver fault run required                                                                                                                                                                                                                                                                                                                                   |
| Cross-tenant exposure                          |                     0 | Security tests and audit evidence                                            | CI tests are evidence; production monitoring unmeasured                                                                                                                                                                                                                                                                                                               |

Prometheus recording rules live in `observability/slo-rules.yaml`; alert rules live in `observability/alerts.yaml`. Zero-tolerance business invariants require durable audit/release-corpus evaluation and are not converted into misleading generic availability percentages.

## Alert response

### Collector or export failure

1. Confirm API/worker health independently. Do not stop lending operations solely because telemetry export is unavailable.
2. Check `http://127.0.0.1:13133/`, Collector logs, receiver rejection counts, memory-limiter messages, and the Tempo endpoint.
3. Preserve application logs and the outage window. Missing telemetry is itself an incident evidence gap.
4. Restore the exporter, verify a synthetic trace and metric end to end, and record the unobserved interval. Never replay provider calls to recreate missing traces.

### API availability or latency

1. Separate application 5xx from proxy/client failures and confirm request volume is non-zero.
2. Use a trace ID to inspect HTTP, policy, workflow-client, Agent, provider, and PostgreSQL spans without searching by borrower data.
3. Check database pool/query latency, Temporal reachability, provider outcomes, event-loop saturation, and recent release changes.
4. Apply the deployment rollback procedure when a release is causal. This repository does not yet contain the staging deployment/rollback implementation, so do not claim that step is automated.

### Provider outcome unknown

1. Treat the operation as potentially completed. Do not retry or fall back automatically.
2. Locate the durable `OUTCOME_UNKNOWN` operation intent through authorized operations tooling.
3. Reconcile through provider status or attributable verified callback evidence.
4. A reviewer resolves the intent; preserve cost reservation until the business outcome is known.

### Webhook terminal failure

1. Inspect the durable delivery history and endpoint status without exposing its secret.
2. Confirm DNS/SSRF validation, receiver health, status-code pattern, and signature-clock agreement.
3. Correct the endpoint or receiver, then use the governed replay operation. Do not edit attempt history.

### Agent budget rejection

1. Use the Agent Budget Operations queue to distinguish exhaustion, deadline, version conflict, and unknown reservation.
2. Do not increase a limit merely to clear an alert. Confirm tenant authority and expected cost first.
3. Reviewer commit/release actions require evidence notes; unknown provider costs remain reserved until reconciled.

### Local Agent planner unavailable or invalid

1. Treat `MODEL_OUTPUT_INVALID`, `MODEL_UNCERTAINTY`, and planner `TOOL_EXECUTION_FAILURE` routes as human-review work. Never bypass the review by editing `agent_runs` or `agent_model_invocations`.
2. Confirm the configured `OLLAMA_MODEL` is installed and `OLLAMA_BASE_URL` is reachable from the worker network. The application never downloads a model automatically.
3. Check only bounded operational metadata: model version, prompt version, digests, route, confidence basis points, and ledger reservation. Prompt and response bodies are deliberately not persisted or logged.
4. Repair the runtime or configuration, then resume through the governed workflow path. A failed reservation is released; a successful immutable invocation is reused on replay so the model is not called twice for the same workflow/case/model/prompt tuple.
5. Keep `think=false` for the two-edge planner unless a future charter and ledger design explicitly accounts for hidden reasoning tokens. Changing the model or prompt version creates a new auditable invocation identity.

### Workflow cancellation and recovery

1. Use the REVIEWER-only **Workflow operations** queue to inspect a tenant's live Temporal status. The queue is bounded to the tenant's 100 most recently changed cases and asks Temporal for each status at read time; it is not a copied workflow-status database.
2. Request cancellation only for a `RUNNING` execution and provide an operational reason. This stops orchestration and records an auditable request; it does **not** establish that any in-flight provider request was cancelled.
3. Reconcile every provider operation that is `OUTCOME_UNKNOWN`, `DISPATCHED`, or otherwise ambiguous before treating its business effect as absent. Never issue a fresh provider request merely because the workflow was cancelled.
4. Recover only `CANCELLED`, `FAILED`, `TIMED_OUT`, or `TERMINATED` executions. A recovery has a new Temporal run id and retains the old run id in its durable outbox trail.
5. The recovery workflow reuses exactly one active condition. If there is none it safely restarts collection; if multiple active conditions exist it routes the case to manual review instead of choosing one. Do not bypass this guard by editing condition rows or Temporal history.

## Backup and restore

RDS automated backups are enabled (`backup_retention_period = 1`, capped by this AWS account's free-tier restrictions — see `terraform/staging/rds.tf`). The snapshot/restore mechanism itself was drilled for real on 2026-08-29 (`staging-drill.yml` `backup-restore`): a real snapshot (`mortgage-agent-staging-drill-20260829091710`) took ~3m33s to become available; restoring it into a separate temporary instance took ~6m40s; a real query against the restored instance (`SELECT COUNT(*) FROM typeorm_migrations`, run via a one-off ECS task) confirmed 45 real migration records present — schema and applied-migration history both survived intact. The temporary instance and the drill snapshot were both torn down afterward and independently confirmed gone. Full detail in `docs/DEVELOPMENT_LOG.md`'s M7-025 entry. This proves the snapshot/restore mechanism works, not an application-level disaster-recovery procedure (re-pointing the app at a restored instance, DNS/connection-string cutover) — that remains a separate, unbuilt exercise.

### Sensitive-data key rotation

`PROVIDER_DATA_ENCRYPTION_KEYS` is an ordered `kid:64hex` key ring covering evidence values, provider receipts, and normalized findings. Put the new key first and retain every old decrypt key. Run `npm run rotate-sensitive-data-encryption` with the admin `DATABASE_URL`; it prints counts only. The staging migration task performs this backfill after migrations and before API/worker rollout. Verify application reads, then keep the old key through at least the authoritative backup-retention window and a restore check; removing it sooner makes an older backup undecryptable. Never paste keys or payloads into tickets, logs, evidence references, or the development journal.

### Data disposition and backup expiry

DELETE/ANONYMIZE removes primary evidence and provider-result content but leaves the task `COMPLETED` until managed copies expire. Work the REVIEWER queue at `GET /v1/data-disposition-tasks/backup-expiry`. After `backupExpiryDueAt`, confirm the authoritative backup/object provider no longer retains the affected copy, then call `POST /v1/data-disposition-tasks/{taskId}/verify-backup-expiry` with a non-sensitive evidence identifier. The API enforces the minimum time and legal-hold state; it does not pretend that elapsed wall time proves an external backup was deleted. A DISPATCHED or ambiguous provider operation blocks disposition until its outcome is reconciled, preventing a late callback/result from restoring removed data.

## Production replacement boundary

For staging/production, keep `OTEL_ENABLED=true`, set a distinct low-cardinality `OTEL_SERVICE_NAME` per process, and point `OTEL_EXPORTER_OTLP_ENDPOINT` to the authorized Collector. The local Tempo filesystem, anonymous Grafana, loopback ports, and Compose volumes are development components, not a deployable production observability tier. Production needs authenticated ingress, encrypted transport, durable object storage, retention/deletion policy, backup, multi-AZ design, capacity tests, alert routing, on-call ownership, and access audit before launch approval.
