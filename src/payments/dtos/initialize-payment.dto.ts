import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class InitializePaymentDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Order ID to initialize Paystack payment for',
  })
  @IsString()
  @IsNotEmpty({ message: 'Order ID is required' })
  orderId: string;

  @ApiPropertyOptional({
    example: 'https://yourfrontend.com/checkout/callback',
    description: 'URL to redirect customer after Paystack payment completes',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Callback URL must be a valid URL' })
  callbackUrl?: string;
}
