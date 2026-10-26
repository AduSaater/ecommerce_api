import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ProcessPaymentDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Order ID to complete payment for',
  })
  @IsString()
  @IsNotEmpty({ message: 'Order ID is required' })
  orderId: string;

  @ApiProperty({
    example: 'paystack',
    description: 'Payment method used (e.g. paystack, credit_card, apple_pay, google_pay)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Payment method is required' })
  paymentMethod: string;

  @ApiPropertyOptional({
    example: 'ORD-MV5QA2XE-0CA925-179183',
    description: 'Optional Paystack transaction reference from Mobile SDK',
  })
  @IsString()
  @IsOptional()
  reference?: string;
}
