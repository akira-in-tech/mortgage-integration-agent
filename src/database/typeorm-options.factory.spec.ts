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
  it('uses DATABASE_URL and enables synchronize outside production', () => {
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

  it('in production with no APP_DATABASE_URL set, falls back to DATABASE_URL rather than failing to boot', () => {
    const options = createTypeOrmOptions(
      mockConfigService({
        NODE_ENV: NodeEnvironment.Production,
        DATABASE_URL:
          'postgres://mortgage:secret@localhost:5432/mortgage_agent',
      }),
    );

    expect(options).toMatchObject({
      url: 'postgres://mortgage:secret@localhost:5432/mortgage_agent',
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
        }),
      ),
    ).toMatchObject({ logging: false });
  });
});
