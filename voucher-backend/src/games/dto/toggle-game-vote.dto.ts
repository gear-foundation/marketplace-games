import { IsString, MaxLength, MinLength } from 'class-validator';

export class ToggleGameVoteDto {
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  account!: string;
}
