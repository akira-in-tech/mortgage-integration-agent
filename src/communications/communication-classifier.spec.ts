import 'reflect-metadata';
import { classifyCommunication } from './communication-classifier';
import { CommunicationTemplate } from '../database/entities/communication-template.entity';
import { CommunicationTemplateStatus } from '../database/enums/communication.enum';

function makeTemplate(
  overrides: Partial<CommunicationTemplate> = {},
): CommunicationTemplate {
  return {
    id: 'template-1',
    tenantId: 'tenant-1',
    templateKey: 'REQUEST_INCOME_EVIDENCE',
    version: '1.0.0',
    channel: 'EMAIL',
    locale: 'en-US',
    recipientRelationship: 'BORROWER',
    bodyTemplate: 'Please provide {{evidenceType}} by {{dueDate}}.',
    allowedVariables: ['evidenceType', 'dueDate'],
    attachmentsAllowed: false,
    status: CommunicationTemplateStatus.APPROVED,
    approvedBy: 'policy-team',
    approvedAt: new Date('2025-01-01T00:00:00Z'),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  } as CommunicationTemplate;
}

const baseInput = {
  recipientRelationship: 'BORROWER',
  channel: 'EMAIL',
  locale: 'en-US',
  templateKey: 'REQUEST_INCOME_EVIDENCE',
  templateVersion: '1.0.0',
  variables: { evidenceType: 'pay stub', dueDate: '2026-09-01' },
  hasAttachments: false,
};

describe('classifyCommunication', () => {
  it('classifies ROUTINE when every Section 6.4 condition holds', () => {
    const result = classifyCommunication(baseInput, makeTemplate());

    expect(result.classification).toBe('ROUTINE');
    expect(result.reasons).toEqual([]);
    expect(result.renderedContent).toBe(
      'Please provide pay stub by 2026-09-01.',
    );
    expect(result.templateId).toBe('template-1');
  });

  it('classifies PROTECTED for free-form content regardless of any template fields', () => {
    const result = classifyCommunication(
      { ...baseInput, freeformContent: 'Your application was denied.' },
      makeTemplate(),
    );

    expect(result.classification).toBe('PROTECTED');
    expect(result.reasons).toEqual(['free-form material text']);
    expect(result.renderedContent).toBe('Your application was denied.');
    expect(result.templateId).toBeNull();
  });

  it('classifies PROTECTED when the referenced template does not exist', () => {
    const result = classifyCommunication(baseInput, null);

    expect(result.classification).toBe('PROTECTED');
    expect(result.reasons).toEqual([
      'referenced template "REQUEST_INCOME_EVIDENCE"@1.0.0 not found',
    ]);
  });

  it('classifies PROTECTED when the template is not APPROVED', () => {
    const result = classifyCommunication(
      baseInput,
      makeTemplate({ status: CommunicationTemplateStatus.DRAFT }),
    );

    expect(result.classification).toBe('PROTECTED');
    expect(result.reasons).toEqual([
      'template "REQUEST_INCOME_EVIDENCE"@1.0.0 is not APPROVED (status: DRAFT)',
    ]);
  });

  it('classifies PROTECTED for an unsupported locale', () => {
    const result = classifyCommunication(
      { ...baseInput, locale: 'fr-FR' },
      makeTemplate(),
    );

    expect(result.classification).toBe('PROTECTED');
    expect(result.reasons).toEqual([
      'locale "fr-FR" is not supported by this template (approved for "en-US")',
    ]);
  });

  it('classifies PROTECTED for a channel mismatch', () => {
    const result = classifyCommunication(
      { ...baseInput, channel: 'SMS' },
      makeTemplate(),
    );

    expect(result.classification).toBe('PROTECTED');
    expect(result.reasons).toEqual([
      'channel "SMS" does not match the approved template\'s channel "EMAIL"',
    ]);
  });

  it('classifies PROTECTED for a recipient relationship mismatch', () => {
    const result = classifyCommunication(
      { ...baseInput, recipientRelationship: 'THIRD_PARTY' },
      makeTemplate(),
    );

    expect(result.classification).toBe('PROTECTED');
    expect(result.reasons).toEqual([
      'recipient relationship "THIRD_PARTY" does not match the approved template\'s "BORROWER"',
    ]);
  });

  it('classifies PROTECTED when attachments are supplied but not allowed', () => {
    const result = classifyCommunication(
      { ...baseInput, hasAttachments: true },
      makeTemplate({ attachmentsAllowed: false }),
    );

    expect(result.classification).toBe('PROTECTED');
    expect(result.reasons).toEqual([
      'attachments are not allowed by this template',
    ]);
  });

  it('classifies PROTECTED with the placeholder left visible for a missing variable', () => {
    const result = classifyCommunication(
      { ...baseInput, variables: { evidenceType: 'pay stub' } },
      makeTemplate(),
    );

    expect(result.classification).toBe('PROTECTED');
    expect(result.reasons).toEqual([
      'failed variable validation: missing value(s) for dueDate',
    ]);
    expect(result.renderedContent).toBe(
      'Please provide pay stub by {{dueDate}}.',
    );
  });

  it('classifies PROTECTED for a variable not declared by the template', () => {
    const result = classifyCommunication(
      {
        ...baseInput,
        variables: { ...baseInput.variables, extra: 'unexpected' },
      },
      makeTemplate(),
    );

    expect(result.classification).toBe('PROTECTED');
    expect(result.reasons).toEqual([
      'failed variable validation: unexpected variable(s) extra not declared by this template',
    ]);
  });

  it('classifies PROTECTED when a variable value contains a negative-implication keyword', () => {
    const result = classifyCommunication(
      {
        ...baseInput,
        variables: { ...baseInput.variables, evidenceType: 'denied claim' },
      },
      makeTemplate(),
    );

    expect(result.classification).toBe('PROTECTED');
    expect(result.reasons).toEqual([
      'negative or ambiguous implication detected in variable "evidenceType"',
    ]);
  });

  it('accumulates every failing reason, not just the first', () => {
    const result = classifyCommunication(
      { ...baseInput, locale: 'fr-FR', channel: 'SMS' },
      makeTemplate({ status: CommunicationTemplateStatus.DRAFT }),
    );

    expect(result.classification).toBe('PROTECTED');
    expect(result.reasons).toHaveLength(3);
  });

  it('throws when neither freeformContent nor a template reference is supplied', () => {
    expect(() =>
      classifyCommunication(
        { ...baseInput, templateKey: undefined, templateVersion: undefined },
        null,
      ),
    ).toThrow(
      'classifyCommunication requires either freeformContent or a templateKey and templateVersion',
    );
  });
});
