import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { InitializePaymentDto } from './dtos/initialize-payment.dto';
import { ProcessPaymentDto } from './dtos/process-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('process')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Directly process / simulate payment for an order',
  })
  @ApiResponse({ status: 201, description: 'Payment completed successfully' })
  @ApiResponse({ status: 400, description: 'Order already paid or invalid state' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async processPayment(
    @CurrentUser('id') userId: string,
    @Body() dto: ProcessPaymentDto,
  ) {
    return this.paymentsService.processPayment(userId, dto);
  }

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Initialize Paystack payment checkout for an order',
  })
  @ApiResponse({
    status: 201,
    description: 'Paystack authorization URL generated',
    schema: {
      type: 'object',
      properties: {
        authorizationUrl: {
          type: 'string',
          example: 'https://checkout.paystack.com/0123456789',
        },
        accessCode: { type: 'string', example: '0123456789' },
        reference: { type: 'string', example: 'ORD-ABC123XYZ' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Order already paid or cancelled' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async initializePayment(
    @CurrentUser('id') userId: string,
    @Body() dto: InitializePaymentDto,
  ) {
    return this.paymentsService.initializePaystackPayment(userId, dto);
  }

  @Get('verify/:reference')
  @ApiOperation({
    summary: 'Verify Paystack payment transaction status by reference',
  })
  @ApiResponse({ status: 200, description: 'Payment verified and status updated' })
  @ApiResponse({ status: 400, description: 'Payment not completed or failed' })
  @ApiResponse({ status: 404, description: 'Payment reference not found' })
  async verifyPayment(@Param('reference') reference: string) {
    return this.paymentsService.verifyPaystackPayment(reference);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paystack webhook receiver' })
  @ApiHeader({
    name: 'x-paystack-signature',
    description: 'HMAC SHA512 signature sent by Paystack',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 403, description: 'Invalid webhook signature' })
  async paystackWebhook(
    @Headers('x-paystack-signature') signature: string,
    @Body() payload: any,
  ) {
    return this.paymentsService.handlePaystackWebhook(signature, payload);
  }

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get payment details for a specific order' })
  @ApiResponse({ status: 200, description: 'Payment details retrieved' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async findByOrderId(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.findByOrderId(userId, role, orderId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'List all payments (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Payments list retrieved' })
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.paymentsService.findAll(Number(page) || 1, Number(limit) || 10);
  }

  @Post(':id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Refund a completed payment (Admin only, restores product stock)',
  })
  @ApiResponse({ status: 200, description: 'Payment refunded successfully' })
  @ApiResponse({ status: 400, description: 'Payment not in COMPLETED status' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async refund(@Param('id') paymentId: string) {
    return this.paymentsService.refund(paymentId);
  }
}
