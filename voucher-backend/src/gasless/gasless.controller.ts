import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Ip,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { GaslessService } from './gasless.service';
import { RequestVoucherDto } from './dto/request-voucher.dto';
import { RevokeVoucherDto } from './dto/revoke-voucher.dto';

// POST /voucher — 6 per IP per hour.
// Players may request the same daily voucher for multiple game programs. The
// throttle counts both failed and successful attempts, so 6/hour leaves retry
// headroom while the per-IP daily VARA ceiling still bounds total abuse.
const VOUCHER_THROTTLE = { default: { limit: 6, ttl: 3600000 } };

// POST /voucher/revoke — does not mint funds, so it should not share the
// stricter issuance throttle. It is still bounded to avoid accidental spam.
const VOUCHER_REVOKE_THROTTLE = { default: { limit: 20, ttl: 60000 } };

// GET /voucher/:account — 20 per IP per minute.
// Read-only state check, no VARA cost. Cheap enough that clients can poll
// mid-session to monitor balance without hitting the limit under honest use.
const VOUCHER_GET_THROTTLE = { default: { limit: 20, ttl: 60000 } };

@Controller()
export class GaslessController {
  constructor(
    private readonly service: GaslessService,
    private readonly configService: ConfigService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'vara-arcade-voucher' };
  }

  @Get('info')
  getInfo(@Headers('x-api-key') apiKey: string) {
    const expected = this.configService.get<string>('infoApiKey');
    if (!expected) throw new ForbiddenException();

    // HMAC both sides to fixed-length digests — prevents length oracle
    const hmac = (v: string) => createHmac('sha256', 'vara-arcade-info').update(v).digest();
    if (!timingSafeEqual(hmac(apiKey ?? ''), hmac(expected))) {
      throw new ForbiddenException();
    }

    return this.service.getVoucherInfo();
  }

  @Post('voucher')
  @Throttle(VOUCHER_THROTTLE)
  requestVoucher(@Body() body: RequestVoucherDto, @Ip() ip: string) {
    return this.service.requestVoucher(body, ip);
  }

  @Post('voucher/revoke')
  @Throttle(VOUCHER_REVOKE_THROTTLE)
  revokeVoucher(@Body() body: RevokeVoucherDto) {
    return this.service.revokeVoucher(body);
  }

  @Get('voucher/:account')
  @Throttle(VOUCHER_GET_THROTTLE)
  getVoucherState(@Param('account') account: string) {
    return this.service.getVoucherState(account);
  }
}
