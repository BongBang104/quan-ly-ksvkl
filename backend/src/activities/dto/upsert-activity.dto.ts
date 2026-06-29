import { IsString, IsOptional, IsIn, IsDateString, MaxLength } from 'class-validator';

export class UpsertActivityDto {
  @IsOptional() @IsString()    @MaxLength(50)   id?:         string;
  @IsOptional() @IsString()    @MaxLength(50)   empId?:      string;
  @IsOptional() @IsIn(['LEAVE', 'SICK', 'TRIP', 'CHANGE', 'OTHER'])
                                                type?:       string;
  @IsOptional() @IsString()    @MaxLength(500)  note?:       string;
  @IsOptional() @IsDateString()                 startDate?:  string;
  @IsOptional() @IsDateString()                 endDate?:    string;
  @IsOptional() @IsString()    @MaxLength(50)   approvedBy?: string;
  @IsOptional() @IsIn(['pending', 'approved', 'rejected'])
                                                status?:     string;
}
