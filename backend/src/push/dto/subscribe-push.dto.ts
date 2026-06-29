import { IsString, IsObject, IsNotEmpty, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

class PushKeysDto {
  @IsString() @IsNotEmpty() p256dh: string;
  @IsString() @IsNotEmpty() auth:   string;
}

export class SubscribePushDto {
  @IsString() @IsNotEmpty() @MaxLength(500) endpoint: string;
  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}
