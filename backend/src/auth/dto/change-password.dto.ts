import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString() @MinLength(8) @MaxLength(200)
  newPassword!: string;
}
