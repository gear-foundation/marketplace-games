import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RevokeVoucherDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(66)
  account: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(66)
  voucherId: string;
}
