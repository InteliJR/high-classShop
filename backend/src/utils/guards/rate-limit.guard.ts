import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private storage: Map<string, RateLimitRecord> = new Map();

  constructor(private reflector: Reflector) {
    // Clean up expired records every minute
    setInterval(() => this.cleanup(), 60000);
  }

  canActivate(context: ExecutionContext): boolean {
    const rateLimitOptions = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rateLimitOptions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const key = this.generateKey(request);
    const now = Date.now();

    const record = this.storage.get(key);

    if (!record || now > record.resetTime) {
      // First request or window expired
      this.storage.set(key, {
        count: 1,
        resetTime: now + rateLimitOptions.windowMs * 1000,
      });
      return true;
    }

    if (record.count >= rateLimitOptions.max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests, please try again later',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.count++;
    return true;
  }

  private generateKey(request: any): string {
    // Use IP + endpoint as key
    const ip = request.ip || request.connection.remoteAddress;
    const endpoint = request.route?.path || request.url;
    return `${ip}:${endpoint}`;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.storage.entries()) {
      if (now > record.resetTime) {
        this.storage.delete(key);
      }
    }
  }
}
