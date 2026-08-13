import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.get<string>('NODE_ENV') !== 'production') {
      return true;
    }

    const configuredKey = this.config.get<string>('API_KEY');
    const request = context.getArgByIndex<{
      req?: { headers?: Record<string, string | string[] | undefined> };
    }>(2)?.req;
    const presented = request?.headers?.['x-api-key'];
    if (!configuredKey || typeof presented !== 'string') {
      throw new UnauthorizedException('valid x-api-key header required');
    }

    const expectedBuffer = Buffer.from(configuredKey);
    const presentedBuffer = Buffer.from(presented);
    if (
      expectedBuffer.length !== presentedBuffer.length ||
      !timingSafeEqual(expectedBuffer, presentedBuffer)
    ) {
      throw new UnauthorizedException('valid x-api-key header required');
    }
    return true;
  }
}
