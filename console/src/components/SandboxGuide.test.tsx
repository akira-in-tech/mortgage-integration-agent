import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SandboxGuide } from './SandboxGuide';
import { getSandboxGuideState } from './sandbox-guide-state';

describe('SandboxGuide', () => {
  it('maps the initial draft case to the real workflow start action', () => {
    expect(getSandboxGuideState('DRAFT', 0, false)).toMatchObject({
      currentStep: 2,
      action: 'start',
      actionLabel: 'Run simulated evaluation',
    });
  });

  it('moves the visitor to the reviewer condition once the workflow creates one', () => {
    const onOpenTab = vi.fn();
    render(
      <SandboxGuide
        status="CONDITIONS_OPEN"
        openConditionCount={1}
        hasAuditEvents={false}
        starting={false}
        onStartEvaluation={vi.fn()}
        onOpenTab={onOpenTab}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /review open condition/i }),
    );
    expect(onOpenTab).toHaveBeenCalledWith('conditions');
    expect(
      screen.getByText(/reviewer condition needs attention/i),
    ).toBeVisible();
  });

  it('keeps workflow start reachable from the initial synthetic record', () => {
    const onStartEvaluation = vi.fn();
    render(
      <SandboxGuide
        status="DRAFT"
        openConditionCount={0}
        hasAuditEvents={false}
        starting={false}
        onStartEvaluation={onStartEvaluation}
        onOpenTab={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /run simulated evaluation/i }),
    );
    expect(onStartEvaluation).toHaveBeenCalledOnce();
  });

  it('describes a manually escalated case without claiming an evaluation is running', () => {
    const onOpenTab = vi.fn();
    render(
      <SandboxGuide
        status="WAITING_FOR_REVIEW"
        openConditionCount={0}
        hasAuditEvents={true}
        starting={false}
        onStartEvaluation={vi.fn()}
        onOpenTab={onOpenTab}
      />,
    );

    expect(screen.getByText(/escalated for reviewer attention/i)).toBeVisible();
    expect(
      screen.queryByText(/evaluation is in progress/i),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /view escalation timeline/i }),
    );
    expect(onOpenTab).toHaveBeenCalledWith('timeline');
  });

  // A real, live-reported bug (2026-09-03): a custom-scenario case (Section
  // 15's "+ New case") can reach READY_FOR_UNDERWRITING without the seeded
  // income-discrepancy rule ever opening a condition, if the visitor's own
  // stated income happens to land within 10% of the simulator's random
  // verified figure. The guide used to always point that case at "Open
  // audit trail" anyway -- a real but empty tab, not a bug in the tab
  // itself. It should say so honestly instead of implying there's a
  // reviewer record waiting there.
  it('sends a handoff-status case with no real audit trail to evidence, not the empty audit tab', () => {
    const onOpenTab = vi.fn();
    render(
      <SandboxGuide
        status="READY_FOR_UNDERWRITING"
        openConditionCount={0}
        hasAuditEvents={false}
        starting={false}
        onStartEvaluation={vi.fn()}
        onOpenTab={onOpenTab}
      />,
    );

    expect(
      screen.getByText(/completed without a reviewer condition/i),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: /view synthetic evidence/i }),
    );
    expect(onOpenTab).toHaveBeenCalledWith('evidence');
  });

  it('still sends a handoff-status case with a real audit trail to the audit tab', () => {
    const onOpenTab = vi.fn();
    render(
      <SandboxGuide
        status="READY_FOR_UNDERWRITING"
        openConditionCount={0}
        hasAuditEvents={true}
        starting={false}
        onStartEvaluation={vi.fn()}
        onOpenTab={onOpenTab}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /open audit trail/i }));
    expect(onOpenTab).toHaveBeenCalledWith('audit');
  });
});
