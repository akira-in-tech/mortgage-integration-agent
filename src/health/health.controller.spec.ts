import 'reflect-metadata';
import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let mockDataSource: jest.Mocked<Pick<DataSource, 'query'>>;

  beforeEach(() => {
    mockDataSource = { query: jest.fn() };
    controller = new HealthController(mockDataSource as unknown as DataSource);
  });

  describe('live()', () => {
    it('always reports ok without touching the database', () => {
      expect(controller.live()).toEqual({ status: 'ok' });
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });
  });

  describe('ready()', () => {
    it('reports ok when the database responds', async () => {
      mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);

      await expect(controller.ready()).resolves.toEqual({ status: 'ok' });
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('throws 503 without leaking the underlying error when the database is unreachable', async () => {
      mockDataSource.query.mockRejectedValue(
        new Error('connection terminated unexpectedly'),
      );

      await expect(controller.ready()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );

      try {
        await controller.ready();
        fail('expected controller.ready() to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        const response = (error as ServiceUnavailableException).getResponse();
        expect(response).toEqual({
          status: 'error',
          reason: 'database unreachable',
        });
        expect(JSON.stringify(response)).not.toContain('connection terminated');
      }
    });
  });
});
