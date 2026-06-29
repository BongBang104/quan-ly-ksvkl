import { IsString, IsOptional, IsBoolean, IsIn, IsEmail, MaxLength, IsDateString } from 'class-validator';

export class UpsertEmployeeDto {
  @IsOptional() @IsString()  @MaxLength(50)  id?:                    string;
  @IsOptional() @IsString()  @MaxLength(100) name?:                  string;
  @IsOptional() @IsString()  @MaxLength(20)  icaoCode?:              string;
  @IsOptional() @IsString()  @MaxLength(50)  team?:                  string;
  @IsOptional() @IsIn(['ADMIN', 'CHIEF', 'STAFF', 'superadmin'])
                                             role?:                  string;
  @IsOptional() @IsString()  @MaxLength(100) position?:              string;
  @IsOptional() @IsString()  @MaxLength(100) qualification?:         string;
  @IsOptional() @IsDateString()              qualificationExpiresAt?: string;
  @IsOptional() @IsBoolean()                 qualificationIsActive?:  boolean;
  @IsOptional() @IsBoolean()                 isChief?:               boolean;
  @IsOptional() @IsBoolean()                 isVip?:                 boolean;
  @IsOptional() @IsString()  @MaxLength(20)  phone?:                 string;
  @IsOptional() @IsEmail()   @MaxLength(100) email?:                 string;
  @IsOptional() @IsBoolean()                 isFirstLogin?:          boolean;
  @IsOptional() @IsBoolean()                 isApproved?:            boolean;
  // password xử lý riêng qua PATCH /:id/password — không nhận qua endpoint này
}
