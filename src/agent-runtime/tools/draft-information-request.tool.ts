import { CommunicationMessageService } from '../../communications/communication-message.service';
import { AgentTool } from '../agent-tool.types';

export interface DraftInformationRequestArgs {
  recipientRelationship: string;
  channel: string;
  locale: string;
  templateKey?: string;
  templateVersion?: string;
  variables?: Record<string, string>;
  freeformContent?: string;
  hasAttachments?: boolean;
}

export interface DraftInformationRequestResult {
  communicationMessageId: string;
  classification: 'PROTECTED' | 'ROUTINE';
  classificationReasons: string[];
}

export interface DraftInformationRequestToolDeps {
  messageService: CommunicationMessageService;
}

/**
 * Section 9.4's `draft_information_request`: "Prepare a remediation
 * request" — "Draft only" side effect, "No" approval boundary, matching
 * Section 6.4: drafting itself needs no approval; only a `PROTECTED`
 * result's eventual delivery does (via `CommunicationApprovalService`,
 * deliberately not a tool the Agent can call — see that service's own
 * comment). This tool only ever persists a `CommunicationMessage`; it
 * never sends anything (no real communication channel exists yet).
 */
export function draftInformationRequestTool(
  deps: DraftInformationRequestToolDeps,
): AgentTool<DraftInformationRequestArgs, DraftInformationRequestResult> {
  return {
    name: 'draft_information_request',
    purpose: 'Prepare a remediation request',
    sideEffect: 'CASE_MUTATION',
    approvalBoundary: 'No',
    async execute({ tenantId, caseId }, args) {
      const message = await deps.messageService.draft(tenantId, caseId, {
        recipientRelationship: args.recipientRelationship,
        channel: args.channel,
        locale: args.locale,
        templateKey: args.templateKey,
        templateVersion: args.templateVersion,
        variables: args.variables ?? {},
        freeformContent: args.freeformContent,
        hasAttachments: args.hasAttachments ?? false,
      });
      return {
        communicationMessageId: message.id,
        classification: message.classification,
        classificationReasons: message.classificationReasons,
      };
    },
  };
}
