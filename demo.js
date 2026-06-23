#!/usr/bin/env node
// Standalone demo — no database, no API key, no Docker required.
// Runs the same rule-based underwriter used by DEMO_MODE=true in the full app.

'use strict';

// ─── ANSI colours ─────────────────────────────────────────────────────────────

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
};

// ─── Rule-based underwriter (mirrors agent.service.ts DEMO_MODE logic) ────────

function getLoanThresholds(loanType) {
  switch (loanType) {
    case 'FHA':   return { minScore: 580, maxDti: 0.57, maxLti: 5.0 };
    case 'VA':    return { minScore: 0,   maxDti: 0.41, maxLti: 5.0 };
    case 'JUMBO': return { minScore: 720, maxDti: 0.38, maxLti: 4.0 };
    default:      return { minScore: 620, maxDti: 0.50, maxLti: 4.5 };
  }
}

function underwrite(profile) {
  const { income, credit, documents, requestedAmount, loanType } = profile;
  const annualIncome = income.monthlyIncome * 12;
  const lti          = requestedAmount / annualIncome;
  const dti          = credit.debtToIncomeRatio;
  const score        = credit.creditScore;
  const t            = getLoanThresholds(loanType);

  const conditions = [];
  const problems   = [];

  if (score < t.minScore) {
    problems.push(`Credit score ${score} is below the ${t.minScore} minimum for ${loanType}`);
  } else if (score < 700) {
    conditions.push('Provide letter of explanation for credit score below 700');
  }

  if (dti > t.maxDti) {
    problems.push(`DTI of ${(dti * 100).toFixed(1)}% exceeds ${(t.maxDti * 100).toFixed(0)}% limit for ${loanType}`);
  } else if (dti > 0.43) {
    conditions.push(`Document compensating factors for DTI of ${(dti * 100).toFixed(1)}% exceeding 43%`);
  }

  if (income.employmentStatus === 'UNEMPLOYED') {
    problems.push('Borrower is currently unemployed');
  } else if (income.employmentStatus === 'SELF_EMPLOYED') {
    conditions.push('Provide 2 years CPA-prepared profit & loss statements');
  }

  if (lti > t.maxLti) {
    problems.push(`Loan-to-income ratio of ${lti.toFixed(2)}x exceeds ${t.maxLti}x guideline`);
  }

  if (!documents.allDocumentsValid) {
    const failed = documents.failedDocuments;
    if (failed.length > 1) {
      problems.push(`Multiple missing documents: ${failed.join(', ')}`);
    } else {
      conditions.push(`Resubmit missing document(s): ${failed.join(', ')}`);
    }
  }

  if (credit.derogatoryMarks >= 2) {
    problems.push(`${credit.derogatoryMarks} derogatory marks exceed acceptable threshold`);
  } else if (credit.derogatoryMarks === 1) {
    conditions.push('Provide written explanation for derogatory credit mark');
  }

  let decision, confidence, reasoning;

  if (problems.length > 0) {
    confidence = Math.max(0.72, Math.min(0.96, 0.96 - problems.length * 0.08));
    decision   = 'DENIED';
    reasoning  = `Application denied: ${problems.join('; ')}.`;
  } else if (conditions.length > 0) {
    confidence = Math.max(0.60, Math.min(0.82, 0.82 - conditions.length * 0.06));
    decision   = 'CONDITIONAL';
    reasoning  = `Conditionally approved pending ${conditions.length} item(s). Score ${score}, DTI ${(dti * 100).toFixed(1)}%, income $${annualIncome.toLocaleString()}/yr.`;
  } else {
    confidence = Math.min(0.99, 0.78 + (score - 700) / 1000 + (0.43 - dti) * 0.5 + 0.05);
    decision   = 'APPROVED';
    reasoning  = `Strong application: score ${score} with ${credit.paymentHistory.toLowerCase()} payment history, DTI ${(dti * 100).toFixed(1)}%, verified income $${annualIncome.toLocaleString()}/yr, all documents valid.`;
  }

  return { decision, confidence, reasoning, conditions };
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function decisionBadge(d) {
  if (d === 'APPROVED')    return `${c.bold}${c.green}✓ APPROVED${c.reset}`;
  if (d === 'CONDITIONAL') return `${c.bold}${c.yellow}◐ CONDITIONAL${c.reset}`;
  return                          `${c.bold}${c.red}✗ DENIED${c.reset}`;
}

function bar(value, width = 24) {
  const filled = Math.round(value * width);
  return `${c.cyan}${'█'.repeat(filled)}${c.gray}${'░'.repeat(width - filled)}${c.reset}`;
}

function printResult(profile, result) {
  const { decision, confidence, reasoning, conditions } = result;
  const { income, credit, documents } = profile;
  const sep = `${c.gray}${'─'.repeat(64)}${c.reset}`;

  console.log('\n' + sep);
  console.log(`  ${c.bold}${profile.name}${c.reset}  ${c.gray}(${profile.loanType} · $${profile.requestedAmount.toLocaleString()})${c.reset}`);
  console.log(sep);
  console.log(`  Decision    ${decisionBadge(decision)}`);
  console.log(`  Confidence  ${bar(confidence)} ${(confidence * 100).toFixed(0)}%`);
  console.log(`  ${c.dim}${reasoning}${c.reset}`);

  if (conditions.length && decision !== 'DENIED') {
    console.log(`\n  ${c.yellow}Conditions required:${c.reset}`);
    conditions.forEach(cond => console.log(`    ${c.yellow}·${c.reset} ${cond}`));
  }

  const annualIncome = income.monthlyIncome * 12;
  console.log(`\n  ${c.gray}Integration data  (fetched in parallel)${c.reset}`);
  console.log(`    ${c.cyan}Plaid${c.reset}    $${annualIncome.toLocaleString()}/yr · ${income.employmentStatus.replace('_', ' ')} · stability ${income.incomeStability}/100`);
  console.log(`    ${c.cyan}Credit${c.reset}   score ${credit.creditScore} · DTI ${(credit.debtToIncomeRatio * 100).toFixed(1)}% · ${credit.paymentHistory.toLowerCase()} history · ${credit.derogatoryMarks} derog`);
  const docsLine = documents.allDocumentsValid
    ? `${c.green}all valid${c.reset}`
    : `${c.red}missing: ${documents.failedDocuments.join(', ')}${c.reset}`;
  console.log(`    ${c.cyan}Docs${c.reset}     ${docsLine}`);
}

// ─── Demo scenarios ───────────────────────────────────────────────────────────

const scenarios = [
  {
    name: 'Sarah Chen',
    requestedAmount: 420_000,
    loanType: 'CONVENTIONAL',
    income:    { monthlyIncome: 12_500, employmentStatus: 'FULL_TIME',    bankAccountAge: 96, incomeStability: 94 },
    credit:    { creditScore: 745, debtToIncomeRatio: 0.31, paymentHistory: 'EXCELLENT', openAccounts: 7, derogatoryMarks: 0 },
    documents: { w2Valid: true, payStubValid: true, bankStatementValid: true, taxReturnValid: true, allDocumentsValid: true, failedDocuments: [] },
  },
  {
    name: 'Marcus Rivera',
    requestedAmount: 285_000,
    loanType: 'FHA',
    income:    { monthlyIncome: 6_800, employmentStatus: 'FULL_TIME',    bankAccountAge: 42, incomeStability: 79 },
    credit:    { creditScore: 648, debtToIncomeRatio: 0.45, paymentHistory: 'FAIR', openAccounts: 9, derogatoryMarks: 1 },
    documents: { w2Valid: true, payStubValid: true, bankStatementValid: false, taxReturnValid: true, allDocumentsValid: false, failedDocuments: ['Bank Statement'] },
  },
  {
    name: 'Jamie Okonkwo',
    requestedAmount: 460_000,
    loanType: 'CONVENTIONAL',
    income:    { monthlyIncome: 9_200, employmentStatus: 'SELF_EMPLOYED', bankAccountAge: 60, incomeStability: 72 },
    credit:    { creditScore: 712, debtToIncomeRatio: 0.48, paymentHistory: 'GOOD', openAccounts: 5, derogatoryMarks: 0 },
    documents: { w2Valid: true, payStubValid: true, bankStatementValid: true, taxReturnValid: true, allDocumentsValid: true, failedDocuments: [] },
  },
  {
    name: 'Derek Huang',
    requestedAmount: 875_000,
    loanType: 'JUMBO',
    income:    { monthlyIncome: 18_000, employmentStatus: 'FULL_TIME',    bankAccountAge: 24, incomeStability: 61 },
    credit:    { creditScore: 695, debtToIncomeRatio: 0.55, paymentHistory: 'POOR', openAccounts: 14, derogatoryMarks: 3 },
    documents: { w2Valid: false, payStubValid: false, bankStatementValid: false, taxReturnValid: false, allDocumentsValid: false, failedDocuments: ['W-2', 'Pay Stub', 'Bank Statement', 'Tax Return'] },
  },
];

// ─── Run ──────────────────────────────────────────────────────────────────────

console.log(`\n${c.bold}${c.cyan}  Mortgage Integration Agent${c.reset}  ${c.gray}demo mode${c.reset}`);
console.log(`${c.gray}  Rule-based underwriter · no API key required · no database${c.reset}`);

for (const profile of scenarios) {
  const result = underwrite(profile);
  printResult(profile, result);
}

console.log('\n' + `${c.gray}${'─'.repeat(64)}${c.reset}`);
console.log(`${c.gray}  Full GraphQL app:  docker-compose up  →  localhost:3000/graphql${c.reset}\n`);
