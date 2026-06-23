import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự.' })
  @MaxLength(200)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message: 'Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số.',
  })
  newPassword!: string;
}
