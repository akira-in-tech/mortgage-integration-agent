import {
  classifyMandatoryReviewTrigger,
  MandatoryReviewCategory,
} from './mandatory-review-triggers';

describe('classifyMandatoryReviewTrigger', () => {
  it('routes policy ambiguity to INTERRUPT_FOR_REVIEW (Section 9.5: "ambiguity... interrupt for review")', () => {
    const trigger = classifyMandatoryReviewTrigger(
      MandatoryReviewCategory.POLICY_AMBIGUITY,
      'jurisdiction "US-ZZ" has no covered policy source',
    );
    expect(trigger.route).toBe('INTERRUPT_FOR_REVIEW');
    expect(trigger.category).toBe(MandatoryReviewCategory.POLICY_AMBIGUITY);
    expect(trigger.reason).toBe(
      '[POLICY_AMBIGUITY] jurisdiction "US-ZZ" has no covered policy source',
    );
  });

  it.each([
    MandatoryReviewCategory.CONSENT_INVALID,
    MandatoryReviewCategory.BUDGET_OR_DEADLINE_EXHAUSTED,
    MandatoryReviewCategory.TOOL_EXECUTION_FAILURE,
  ])(
    'routes %s to ROUTE_TO_MANUAL_REVIEW (Section 9.5: "budget or runtime failure: route to manual review")',
    (category) => {
      const trigger = classifyMandatoryReviewTrigger(category, 'detail');
      expect(trigger.route).toBe('ROUTE_TO_MANUAL_REVIEW');
      expect(trigger.category).toBe(category);
    },
  );

  it('prefixes the reason string with the category so it is legible standalone', () => {
    const trigger = classifyMandatoryReviewTrigger(
      MandatoryReviewCategory.BUDGET_OR_DEADLINE_EXHAUSTED,
      'remainingStepBudget exhausted',
    );
    expect(trigger.reason).toBe(
      '[BUDGET_OR_DEADLINE_EXHAUSTED] remainingStepBudget exhausted',
    );
  });
});
