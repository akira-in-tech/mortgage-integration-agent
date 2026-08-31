# Staging — applied only from CI

This module is meant to run exclusively through
`.github/workflows/deploy-staging.yml`, which assumes the OIDC role
`terraform/bootstrap/` created — never from a local machine with a
personal credential. Its state lives in the S3 backend that
`terraform/bootstrap/` provisioned.

## Scope (Phase 1)

- API (`main.ts`), Worker (`worker.ts`), and a self-hosted Temporal
  server — the same three processes `docker-compose.yml` runs locally,
  on the same RDS Postgres.
- A public Application Load Balancer, **HTTP only** — there is no
  domain to validate an ACM certificate against yet.
- No Keycloak (real OIDC login) and no deployed console — this
  environment is REST/GraphQL-with-a-bearer-token only, reached
  directly, not through the browser console. Both are a named Phase 2,
  not started here.

The machine-bearer routes reject anonymous requests, but the current
public HTTP listener is not a browser-authenticated or TLS-protected
environment. Do not use it for real borrower data or transmit a bearer token
over an untrusted network. A continuously accessible browser demo needs a
domain-backed HTTPS listener plus a real OIDC provider before it can meet that
boundary.

## What isn't here yet

Load/soak testing, a backup/restore drill, and a formal failure-recovery
exercise are still open — they need this infrastructure to exist first.
See `docs/DEVELOPMENT_LOG.md`'s M7-024 entry for the full accounting.

## Applying a change locally (rare — normally CI does this)

```bash
cd terraform/staging
terraform init -backend-config=../bootstrap-backend-values.txt # or pass each -backend-config=key=value flag directly
terraform plan -var="image_tag=<a-real-tag-already-in-ecr>"
```

You'll need the same OIDC-assumed AWS session CI uses (e.g. via
`aws sts assume-role` locally with your own IAM permissions to assume
`terraform/bootstrap`'s deploy role) — this module has no independent
credential path of its own by design.
