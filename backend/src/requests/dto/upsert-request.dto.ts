import { IsString, IsOptional, IsIn, IsDateString, IsObject, MaxLength } from 'class-validator';

export class UpsertRequestDto {
  @IsOptional() @IsString()    @MaxLength(50)  id?:           string;
  @IsOptional() @IsString()    @MaxLength(50)  employeeId?:   string;
  @IsOptional() @IsIn(['Đổi ca', 'Nghỉ phép', 'Nghỉ ốm', 'Công tác'])
                                               type?:         string;
  @IsOptional() @IsString()    @MaxLength(500) note?:         string;
  @IsOptional() @IsDateString()                startDate?:    string;
  @IsOptional() @IsDateString()                endDate?:      string;
  @IsOptional() @IsString()                    status?:       string;
  @IsOptional() @IsString()    @MaxLength(50)  reviewedBy?:   string;
  @IsOptional() @IsString()    @MaxLength(500) reviewNote?:   string;
  @IsOptional() @IsObject()                    extraData?:    Record<string, any>;
  // Frontend fields lưu vào extraData — validate lỏng để không breaking change
  @IsOptional() @IsString()                    requesterId?:  string;
  @IsOptional() @IsString()                    requesterName?: string;
  @IsOptional() @IsString()                    requesterTeam?: string;
  @IsOptional() @IsString()                    targetEmpId?:  string;
  @IsOptional() @IsString()                    targetEmpName?: string;
  @IsOptional() @IsString()                    date?:         string;
  @IsOptional() @IsString()                    reason?:       string;
  @IsOptional() @IsString()                    shiftCode?:    string;
  @IsOptional() @IsObject()                    approvals?:    Record<string, boolean>;
}
