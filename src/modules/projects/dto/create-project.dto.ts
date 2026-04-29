import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { ProjectVisibility } from '@prisma/client';

export class CreateProjectDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsString()
  @Length(2, 10)
  @Matches(/^[A-Z][A-Z0-9]+$/, {
    message:
      'key must be uppercase letters/digits, starting with a letter (e.g. ENG, WEB2)',
  })
  key!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsOptional()
  @IsEnum(ProjectVisibility)
  visibility?: ProjectVisibility;
}
