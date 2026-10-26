import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({
    example: '123 Main Street, Apt 4B, New York, NY 10001, USA',
    description: 'Shipping address for the order delivery',
  })
  @IsString()
  @IsNotEmpty({ message: 'Shipping address is required' })
  shippingAddress: string;
}
