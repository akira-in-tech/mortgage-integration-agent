import 'reflect-metadata';
import { CommunicationDeliverySimulator } from './communication-delivery-simulator';

describe('CommunicationDeliverySimulator', () => {
  const simulator = new CommunicationDeliverySimulator();

  it('returns a deterministic delivery reference for the same message id and content hash', async () => {
    const first = await simulator.send('message-1', 'hash-a', 'EMAIL');
    const second = await simulator.send('message-1', 'hash-a', 'EMAIL');
    expect(first.deliveryReference).toBe(second.deliveryReference);
    expect(first.deliveryReference).toMatch(/^sim-[0-9a-f]{24}$/);
  });

  it('returns a different delivery reference when the content hash differs', async () => {
    const first = await simulator.send('message-1', 'hash-a', 'EMAIL');
    const second = await simulator.send('message-1', 'hash-b', 'EMAIL');
    expect(first.deliveryReference).not.toBe(second.deliveryReference);
  });

  it('returns a different delivery reference for a different message id', async () => {
    const first = await simulator.send('message-1', 'hash-a', 'EMAIL');
    const second = await simulator.send('message-2', 'hash-a', 'EMAIL');
    expect(first.deliveryReference).not.toBe(second.deliveryReference);
  });
});
