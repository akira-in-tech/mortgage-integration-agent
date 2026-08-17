import {
  CommunicationDeliveryService,
  DeliverCommunicationResult,
} from '../../communications/communication-delivery.service';
import { AgentTool } from '../agent-tool.types';

export interface SendInformationRequestArgs {
  communicationMessageId: string;
}

export interface SendInformationRequestToolDeps {
  communicationDeliveryService: CommunicationDeliveryService;
}

/**
 * Section 9.4's `send_information_request`: "Deliver an external
 * message" — approval boundary "Configured policy only for a
 * version-pinned routine operational template; exact human approval is
 * mandatory for protected, uncertain, or modified content; formal
 * notices outside product scope remain prohibited," enforced structurally
 * by `CommunicationDeliveryService.deliver()`'s own ready-to-send gate,
 * not just documented here. A thin wrapper, same pattern as
 * `evaluate_policy`.
 */
export function sendInformationRequestTool(
  deps: SendInformationRequestToolDeps,
): AgentTool<SendInformationRequestArgs, DeliverCommunicationResult> {
  return {
    name: 'send_information_request',
    purpose: 'Deliver an external message',
    sideEffect: 'EXTERNAL_COMMUNICATION',
    approvalBoundary:
      'Configured policy only for a version-pinned routine operational template; exact human approval is mandatory for protected, uncertain, or modified content; formal notices outside product scope remain prohibited',
    async execute(_context, args) {
      return deps.communicationDeliveryService.deliver(
        args.communicationMessageId,
      );
    },
  };
}
