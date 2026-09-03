import 'reflect-metadata';
import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';
import { TemporalClientService } from '../workflows/temporal-client.service';

describe('HealthController', () => {
  let controller: HealthController;
  let mockDataSource: jest.Mocked<Pick<DataSource, 'query'>>;
  let mockTemporalClient: jest.Mocked<
    Pick<TemporalClientService, 'checkConnectivity'>
  >;

  beforeEach(() => {
    mockDataSource = { query: jest.fn() };
    mockTemporalClient = { checkConnectivity: jest.fn() };
    controller = new HealthController(
      mockDataSource as unknown as DataSource,
      mockTemporalClient as unknown as TemporalClientService,
    );
  });

  describe('live()', () => {
    it('always reports ok without touching the database', () => {
      expect(controller.live()).toEqual({ status: 'ok' });
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });
  });

  describe('ready()', () => {
    it('reports ok when both the database and Temporal respond', async () => {
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      mockTemporalClient.checkConnectivity.mockResolvedValue(undefined);

      await expect(controller.ready()).resolves.toEqual({ status: 'ok' });
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockTemporalClient.checkConnectivity).toHaveBeenCalled();
    });

    it('throws 503 without leaking the underlying error when the database is unreachable', async () => {
      mockDataSource.query.mockRejectedValue(
        new Error('connection terminated unexpectedly'),
      );
      mockTemporalClient.checkConnectivity.mockResolvedValue(undefined);

      const response = await getFailureResponse();
      expect(response).toEqual({
        status: 'error',
        reason: 'database unreachable',
      });
      expect(JSON.stringify(response)).not.toContain('connection terminated');
    });

    // M7-073: the real, live-discovered gap this closes -- a database that
    // is perfectly healthy told this endpoint nothing about a real
    // "Failed to connect before the deadline" Temporal outage.
    it('throws 503 without leaking the underlying error when Temporal is unreachable', async () => {
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
      mockTemporalClient.checkConnectivity.mockRejectedValue(
        new Error('Failed to connect before the deadline'),
      );

      const response = await getFailureResponse();
      expect(response).toEqual({
        status: 'error',
        reason: 'Temporal unreachable',
      });
      expect(JSON.stringify(response)).not.toContain('before the deadline');
    });

    it('reports both reasons when the database and Temporal are both unreachable', async () => {
      mockDataSource.query.mockRejectedValue(new Error('db down'));
      mockTemporalClient.checkConnectivity.mockRejectedValue(
        new Error('temporal down'),
      );

      const response = await getFailureResponse();
      expect(response).toEqual({
        status: 'error',
        reason: 'database and Temporal unreachable',
      });
    });

    async function getFailureResponse(): Promise<unknown> {
      await expect(controller.ready()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      try {
        await controller.ready();
        fail('expected controller.ready() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        return (error as ServiceUnavailableException).getResponse();
      }
    }
  });
});
