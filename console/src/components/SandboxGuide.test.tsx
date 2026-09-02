import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SandboxGuide } from './SandboxGuide';
import { getSandboxGuideState } from './sandbox-guide-state';

describe('SandboxGuide', () => {
  it('maps the initial draft case to the real workflow start action', () => {
    expect(getSandboxGuideState('DRAFT', 0)).toMatchObject({
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
});
