// k6 load/soak test for the real, deployed staging environment
// (terraform/staging/, see .github/workflows/staging-drill.yml).
//
// Scope, on purpose: this only hits the two unauthenticated health
// endpoints (src/health/health.controller.ts). Every other API route
// needs a real tenant/bearer token, and hammering those with synthetic
// load would leave garbage data in the real staging database - that's
// a bigger, separate task (seed a dedicated synthetic load-test
// tenant), not something to fake here. So this measures the API +
// ALB + RDS-connection layer under load, not full business-workflow
// latency. Say that plainly wherever these numbers get reported -
// never claim more than what was actually measured.
//
// Scale, on purpose: staging is one db.t4g.micro and one Fargate task
// per service, with no auto-scaling. This is a "is it healthy under a
// modest sustained load" check, not a capacity/breaking-point test.
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    // Pure liveness - no DB touch, the highest throughput this API can
    // possibly serve. A ceiling to compare /health/ready against.
    live_throughput: {
      executor: 'constant-vus',
      exec: 'hitLive',
      vus: 20,
      duration: '2m',
    },
    // One real `SELECT 1` per request - exercises the actual RDS
    // connection under sustained concurrent load.
    ready_with_db: {
      executor: 'constant-vus',
      exec: 'hitReady',
      vus: 20,
      duration: '3m',
      startTime: '2m', // runs right after live_throughput finishes
    },
  },
  thresholds: {
    // Real pass/fail signal for CI - k6 exits non-zero if these are
    // violated, so a genuinely unhealthy result fails the workflow
    // rather than silently uploading a report nobody reads.
    'http_req_failed{scenario:live_throughput}': ['rate<0.01'],
    'http_req_failed{scenario:ready_with_db}': ['rate<0.01'],
    'http_req_duration{scenario:ready_with_db}': ['p(95)<500'],
  },
};

const BASE_URL = __ENV.STAGING_BASE_URL;

export function hitLive() {
  const res = http.get(`${BASE_URL}/health/live`);
  check(res, { 'live: status 200': (r) => r.status === 200 });
  sleep(0.1);
}

export function hitReady() {
  const res = http.get(`${BASE_URL}/health/ready`);
  check(res, { 'ready: status 200': (r) => r.status === 200 });
  sleep(0.1);
}
