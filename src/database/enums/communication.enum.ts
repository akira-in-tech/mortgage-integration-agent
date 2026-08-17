/**
 * Section 6.4's two communication classes. `PROTECTED` requires exact
 * human approval before delivery; `ROUTINE` may follow the configured
 * policy path only when every one of 6.4's conditions holds (see
 * `CommunicationClassifierService`) — anything that fails even one of
 * them is `PROTECTED`, never a partial or best-effort routine class.
 */
export enum CommunicationClassification {
  PROTECTED = 'PROTECTED',
  ROUTINE = 'ROUTINE',
}

export enum CommunicationTemplateStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  RETIRED = 'RETIRED',
}

export enum CommunicationMessageStatus {
  DRAFTED = 'DRAFTED',
  AWAITING_APPROVAL = 'AWAITING_APPROVAL',
  APPROVED = 'APPROVED',
}
