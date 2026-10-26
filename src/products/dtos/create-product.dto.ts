import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty({ example: 'Wireless Noise Canceling Headphones', description: 'Product title' })
  @IsString()
  @IsNotEmpty({ message: 'Product name is required' })
  name: string;

  @ApiPropertyOptional({
    example: 'Premium over-ear headphones with active noise cancellation and 30-hour battery life.',
    description: 'Product description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 199.99, description: 'Price in USD' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Price cannot be negative' })
  price: number;

  @ApiProperty({ example: 50, description: 'Inventory stock level' })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Stock cannot be negative' })
  stock: number;

  @ApiProperty({ example: 'WH-1000XM5', description: 'Unique stock keeping unit' })
  @IsString()
  @IsNotEmpty({ message: 'SKU is required' })
  sku: string;

  @ApiPropertyOptional({
    example: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
    description: 'Product primary image URL',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Associated Category ID' })
  @IsString()
  @IsNotEmpty({ message: 'Category ID is required' })
  categoryId: string;
}
