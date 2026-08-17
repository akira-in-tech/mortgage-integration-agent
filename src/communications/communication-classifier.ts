import { CommunicationTemplate } from '../database/entities/communication-template.entity';
import {
  CommunicationClassification,
  CommunicationTemplateStatus,
} from '../database/enums/communication.enum';
import { renderTemplate } from './communication-render';

export interface DraftCommunicationInput {
  recipientRelationship: string;
  channel: string;
  locale: string;
  templateKey?: string;
  templateVersion?: string;
  variables: Record<string, string>;
  /** Presence alone forces PROTECTED (Section 6.4: "free-form material text"), regardless of any template fields also supplied. */
  freeformContent?: string;
  hasAttachments: boolean;
}

export interface ClassificationOutcome {
  classification: CommunicationClassification;
  reasons: string[];
  renderedContent: string;
  templateId: string | null;
}

/**
 * Deliberately crude and explicit, not semantic understanding: a
 * substring blocklist scanned only against caller-supplied *variable
 * values*, never the template body itself (which a human already
 * approved). Section 6.4 requires detecting "negative or ambiguous
 * implication" as a deterministic, non-model guard (Section 9.7: "no
 * arbitrary... code execution," and classification must stay "outside
 * the model") — a real NLP/sentiment classifier is exactly the kind of
 * model-based judgment this guard is required not to depend on. This
 * catches an obvious case (a variable value accidentally carrying
 * adverse-outcome language into an otherwise-routine template) and
 * nothing subtler; known gap, not a claim of true semantic detection.
 */
const NEGATIVE_IMPLICATION_KEYWORDS = [
  'denied',
  'denial',
  'reject',
  'ineligible',
  'ineligibility',
  'adverse',
  'not approved',
  'unable to approve',
  'disqualif',
  'cannot proceed',
  'terminated',
  'cancel',
];

function findNegativeImplication(
  variables: Record<string, string>,
): string | undefined {
  for (const [key, value] of Object.entries(variables)) {
    const lower = value.toLowerCase();
    if (
      NEGATIVE_IMPLICATION_KEYWORDS.some((keyword) => lower.includes(keyword))
    ) {
      return key;
    }
  }
  return undefined;
}

/**
 * Section 6.4's classifier, as a deterministic application-service guard
 * outside the model (per that section's own requirement) — pure given a
 * template lookup result, so it's testable without a database. A
 * `ROUTINE` result requires every one of 6.4's conditions to hold; any
 * single failure — free-form text, an unapproved/mismatched/missing
 * template, a variable-validation failure, or a detected negative
 * implication — upgrades to `PROTECTED` with the specific reason(s)
 * recorded, never silently.
 */
export function classifyCommunication(
  input: DraftCommunicationInput,
  template: CommunicationTemplate | null,
): ClassificationOutcome {
  if (input.freeformContent !== undefined) {
    return {
      classification: CommunicationClassification.PROTECTED,
      reasons: ['free-form material text'],
      renderedContent: input.freeformContent,
      templateId: null,
    };
  }

  if (!input.templateKey || !input.templateVersion) {
    throw new Error(
      'classifyCommunication requires either freeformContent or a templateKey and templateVersion',
    );
  }

  if (!template) {
    return {
      classification: CommunicationClassification.PROTECTED,
      reasons: [
        `referenced template "${input.templateKey}"@${input.templateVersion} not found`,
      ],
      renderedContent: '',
      templateId: null,
    };
  }

  const reasons: string[] = [];
  const { content, missingVariables, unknownVariables } = renderTemplate(
    template.bodyTemplate,
    template.allowedVariables,
    input.variables,
  );

  if (template.status !== CommunicationTemplateStatus.APPROVED) {
    reasons.push(
      `template "${input.templateKey}"@${input.templateVersion} is not APPROVED (status: ${template.status})`,
    );
  }
  if (template.channel !== input.channel) {
    reasons.push(
      `channel "${input.channel}" does not match the approved template's channel "${template.channel}"`,
    );
  }
  if (template.locale !== input.locale) {
    reasons.push(
      `locale "${input.locale}" is not supported by this template (approved for "${template.locale}")`,
    );
  }
  if (template.recipientRelationship !== input.recipientRelationship) {
    reasons.push(
      `recipient relationship "${input.recipientRelationship}" does not match the approved template's "${template.recipientRelationship}"`,
    );
  }
  if (input.hasAttachments && !template.attachmentsAllowed) {
    reasons.push('attachments are not allowed by this template');
  }
  if (missingVariables.length > 0) {
    reasons.push(
      `failed variable validation: missing value(s) for ${missingVariables.join(', ')}`,
    );
  }
  if (unknownVariables.length > 0) {
    reasons.push(
      `failed variable validation: unexpected variable(s) ${unknownVariables.join(', ')} not declared by this template`,
    );
  }
  const flaggedVariable = findNegativeImplication(input.variables);
  if (flaggedVariable) {
    reasons.push(
      `negative or ambiguous implication detected in variable "${flaggedVariable}"`,
    );
  }

  return {
    classification:
      reasons.length === 0
        ? CommunicationClassification.ROUTINE
        : CommunicationClassification.PROTECTED,
    reasons,
    renderedContent: content,
    templateId: template.id,
  };
}
