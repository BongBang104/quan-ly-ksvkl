import { IsString, IsOptional, IsIn, IsArray, IsObject, MaxLength, IsDateString } from 'class-validator';

export class UpsertTaskDto {
  @IsOptional() @IsString()  @MaxLength(50)   id?:            string;
  @IsOptional() @IsString()  @MaxLength(50)   team?:          string;
  @IsOptional() @IsString()  @MaxLength(200)  title?:         string;
  @IsOptional() @IsString()  @MaxLength(5000) description?:   string;
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
                                              priority?:      string;
  @IsOptional() @IsIn(['pending', 'in_progress', 'done', 'cancelled'])
                                              status?:        string;
  @IsOptional() @IsString()  @MaxLength(50)   assignedTo?:    string;
  @IsOptional() @IsDateString()               dueDate?:       string;
  @IsOptional() @IsString()  @MaxLength(50)   createdBy?:     string;
  @IsOptional() @IsIn(['team', 'unit', 'private'])
                                              visibility?:    string;
  @IsOptional() @IsArray()                    targetEmpIds?:  string[];
  @IsOptional() @IsArray()                    comments?:      Record<string, any>[];
  @IsOptional() @IsArray()                    acknowledgments?: Record<string, any>[];
  @IsOptional() @IsObject()                   extraData?:     Record<string, any>;
}
