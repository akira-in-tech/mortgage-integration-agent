import { ObjectType, Field } from '@nestjs/graphql';

/**
 * `sendCommunicationMessage`'s GraphQL mutation return type — the
 * `outcome: 'DELIVERED'` half of `DeliverCommunicationResult`
 * (`communication-delivery.service.ts`), a TypeScript discriminated
 * union. The `outcome: 'NOT_READY'` half never reaches this type: the
 * resolver throws `ConflictException` for it instead, exactly matching
 * `CommunicationMessagesController.send()`'s own REST behavior.
 */
@ObjectType()
export class CommunicationDeliveryResult {
  @Field()
  outcome!: string;

  @Field()
  deliveryReference!: string;

  @Field()
  sentAt!: string;
}
