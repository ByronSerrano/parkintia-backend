import { IsNotEmpty, IsArray, ValidateNested, IsNumber, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class CoordinateDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

export class CreateParkingZoneDto {
  @IsNotEmpty()
  @IsString()
  cameraId: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsNumber()
  spaceNumber: number;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoordinateDto)
  coordinates: CoordinateDto[];
}

export class UpdateParkingZoneDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoordinateDto)
  coordinates?: CoordinateDto[];

  @IsOptional()
  @IsNumber()
  spaceNumber?: number;
}

export class BulkCreateParkingZonesDto {
  @IsNotEmpty()
  @IsString()
  cameraId: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParkingZoneDto)
  zones: Omit<CreateParkingZoneDto, 'cameraId'>[];
}
