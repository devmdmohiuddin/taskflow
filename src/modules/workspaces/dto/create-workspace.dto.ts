import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @Length(2, 60)
  name!: string;

  @IsString()
  @Length(2, 40)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}
