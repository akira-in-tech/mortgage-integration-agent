import { ConfigService } from '@nestjs/config';
import { createTypeOrmOptions } from './typeorm-options.factory';
import { NodeEnvironment } from '../config/env.validation';

function mockConfigService(
  values: Partial<Record<string, string>>,
): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('createTypeOrmOptions', () => {
  it('uses DATABASE_URL and enables synchronize in development', () => {
    const options = createTypeOrmOptions(
      mockConfigService({
        NODE_ENV: NodeEnvironment.Development,
        DATABASE_URL:
          'postgres://mortgage:secret@localhost:5432/mortgage_agent',
      }),
    );

    expect(options).toMatchObject({
      url: 'postgres://mortgage:secret@localhost:5432/mortgage_agent',
      synchronize: true,
    });
  });

  it('in production, prefers APP_DATABASE_URL over DATABASE_URL and disables synchronize', () => {
    const options = createTypeOrmOptions(
      mockConfigService({
        NODE_ENV: NodeEnvironment.Production,
        DATABASE_URL:
          'postgres://mortgage:secret@localhost:5432/mortgage_agent',
        APP_DATABASE_URL:
          'postgres://mortgage_app:secret@localhost:5432/mortgage_agent',
      }),
    );

    expect(options).toMatchObject({
      url: 'postgres://mortgage_app:secret@localhost:5432/mortgage_agent',
      synchronize: false,
    });
  });

  it('fails closed in production with no restricted runtime connection', () => {
    expect(() =>
      createTypeOrmOptions(
        mockConfigService({
          NODE_ENV: NodeEnvironment.Production,
          DATABASE_URL:
            'postgres://mortgage:secret@localhost:5432/mortgage_agent',
        }),
      ),
    ).toThrow(/APP_DATABASE_URL/);
  });

  it('uses the restricted runtime role and disables synchronize in staging', () => {
    const options = createTypeOrmOptions(
      mockConfigService({
        NODE_ENV: NodeEnvironment.Staging,
        DATABASE_URL:
          'postgres://mortgage:secret@localhost:5432/mortgage_agent',
        APP_DATABASE_URL:
          'postgres://mortgage_app:secret@localhost:5432/mortgage_agent',
      }),
    );

    expect(options).toMatchObject({
      url: 'postgres://mortgage_app:secret@localhost:5432/mortgage_agent',
      synchronize: false,
    });
  });

  it("ignores APP_DATABASE_URL outside production — local dev keeps using DATABASE_URL's DDL-capable role", () => {
    const options = createTypeOrmOptions(
      mockConfigService({
        NODE_ENV: NodeEnvironment.Development,
        DATABASE_URL:
          'postgres://mortgage:secret@localhost:5432/mortgage_agent',
        APP_DATABASE_URL:
          'postgres://mortgage_app:secret@localhost:5432/mortgage_agent',
      }),
    );

    expect(options).toMatchObject({
      url: 'postgres://mortgage:secret@localhost:5432/mortgage_agent',
      synchronize: true,
    });
  });

  it('enables query logging only in development', () => {
    expect(
      createTypeOrmOptions(
        mockConfigService({
          NODE_ENV: NodeEnvironment.Development,
          DATABASE_URL: 'postgres://x/y',
        }),
      ),
    ).toMatchObject({ logging: true });

    expect(
      createTypeOrmOptions(
        mockConfigService({
          NODE_ENV: NodeEnvironment.Staging,
          DATABASE_URL: 'postgres://x/y',
          APP_DATABASE_URL: 'postgres://app/x',
        }),
      ),
    ).toMatchObject({ logging: false });
  });
});
