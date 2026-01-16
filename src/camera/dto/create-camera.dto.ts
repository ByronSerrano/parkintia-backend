import { IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateCameraDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  streamUrl?: string;

  @IsOptional()
  @IsString()
  videoFile?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
