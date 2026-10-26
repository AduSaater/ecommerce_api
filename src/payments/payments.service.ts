import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { InitializePaymentDto } from './dtos/initialize-payment.dto';
import { ProcessPaymentDto } from './dtos/process-payment.dto';
import { OrderStatus, PaymentStatus, Role } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly paystackBaseUrl = 'https://api.paystack.co';

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  private getPaystackSecretKey(): string {
    const key =
      this.configService.get<string>('PAYSTACK_SECRET_KEY') ||
      process.env.PAYSTACK_SECRET_KEY;
    if (!key || key === 'your_paystack_secret_key') {
      throw new InternalServerErrorException(
        'Paystack secret key is not configured in .env (PAYSTACK_SECRET_KEY)',
      );
    }
    return key;
  }

  async processPayment(userId: string, dto: ProcessPaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${dto.orderId} not found`);
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('You cannot pay for an order that is not yours');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot pay for a cancelled order');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Order is already delivered');
    }

    if (order.payment?.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Payment for this order has already been completed');
    }

    const transactionId =
      dto.reference ||
      `PAYSTACK-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const currency =
      this.configService.get<string>('PAYSTACK_CURRENCY') ||
      process.env.PAYSTACK_CURRENCY ||
      'NGN';

    return this.prisma.$transaction(async (tx) => {
      let paymentRecord;
      if (order.payment) {
        paymentRecord = await tx.payment.update({
          where: { id: order.payment.id },
          data: {
            transactionId,
            paymentMethod: dto.paymentMethod,
            status: PaymentStatus.COMPLETED,
            amount: order.totalAmount,
            currency,
          },
        });
      } else {
        paymentRecord = await tx.payment.create({
          data: {
            orderId: order.id,
            userId,
            amount: order.totalAmount,
            currency,
            status: PaymentStatus.COMPLETED,
            paymentMethod: dto.paymentMethod,
            transactionId,
          },
        });
      }

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PROCESSING,
        },
      });

      return {
        status: 'success',
        message: 'Payment processed successfully',
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          amount: Number(order.totalAmount),
          currency,
          paymentStatus: paymentRecord.status,
          orderStatus: updatedOrder.status,
          paymentMethod: paymentRecord.paymentMethod,
          transactionId: paymentRecord.transactionId,
        },
        payment: paymentRecord,
        order: updatedOrder,
      };
    });
  }

  async initializePaystackPayment(userId: string, dto: InitializePaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        user: true,
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${dto.orderId} not found`);
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('You cannot pay for an order that is not yours');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot pay for a cancelled order');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Order is already delivered');
    }

    if (order.payment?.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Payment for this order has already been completed');
    }

    const secretKey = this.getPaystackSecretKey();
    const currency =
      this.configService.get<string>('PAYSTACK_CURRENCY') ||
      process.env.PAYSTACK_CURRENCY ||
      'NGN';

    // Amount in subunits (e.g. kobo or cents)
    const amountInSubunits = Math.round(Number(order.totalAmount) * 100);
    const reference = `ORD-${order.orderNumber}-${Date.now().toString(36).toUpperCase()}`;

    const payload = {
      email: order.user.email,
      amount: amountInSubunits,
      currency,
      reference,
      callback_url: dto.callbackUrl,
      metadata: {
        orderId: order.id,
        userId: order.userId,
        orderNumber: order.orderNumber,
      },
    };

    let paystackResponse: any;
    try {
      const response = await fetch(`${this.paystackBaseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      paystackResponse = await response.json();
    } catch (err: any) {
      throw new InternalServerErrorException(
        `Failed to reach Paystack gateway: ${err.message}`,
      );
    }

    if (!paystackResponse || !paystackResponse.status) {
      throw new BadRequestException(
        paystackResponse?.message || 'Paystack initialization failed',
      );
    }

    // Save/update payment record with Paystack reference
    if (order.payment) {
      await this.prisma.payment.update({
        where: { id: order.payment.id },
        data: {
          transactionId: reference,
          paymentMethod: 'paystack',
          currency,
          status: PaymentStatus.PENDING,
        },
      });
    } else {
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          userId,
          amount: order.totalAmount,
          currency,
          status: PaymentStatus.PENDING,
          paymentMethod: 'paystack',
          transactionId: reference,
        },
      });
    }

    return {
      status: 'success',
      message: 'Payment initialized successfully',
      data: {
        authorizationUrl: paystackResponse.data.authorization_url,
        accessCode: paystackResponse.data.access_code,
        reference: paystackResponse.data.reference,
      },
    };
  }

  async verifyPaystackPayment(reference: string) {
    const secretKey = this.getPaystackSecretKey();

    let paystackResponse: any;
    try {
      const response = await fetch(
        `${this.paystackBaseUrl}/transaction/verify/${encodeURIComponent(reference)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        },
      );
      paystackResponse = await response.json();
    } catch (err: any) {
      throw new InternalServerErrorException(
        `Failed to reach Paystack gateway: ${err.message}`,
      );
    }

    if (!paystackResponse || !paystackResponse.status) {
      throw new BadRequestException(
        paystackResponse?.message || 'Payment verification failed at Paystack',
      );
    }

    const data = paystackResponse.data;
    const payment = await this.prisma.payment.findFirst({
      where: { transactionId: reference },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException(`No payment found with reference ${reference}`);
    }

    if (data.status === 'success') {
      return this.prisma.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.COMPLETED,
            paymentMethod: data.channel || 'paystack',
          },
        });

        const updatedOrder = await tx.order.update({
          where: { id: payment.orderId },
          data: {
            status: OrderStatus.PROCESSING,
          },
        });

        return {
          status: 'success',
          message: 'Payment verified and confirmed successfully',
          data: {
            reference,
            amount: Number(payment.amount),
            currency: payment.currency,
            paidAt: data.paid_at,
            channel: data.channel,
          },
          payment: updatedPayment,
          order: updatedOrder,
        };
      });
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
        },
      });

      return {
        status: data.status,
        message: data.gateway_response || 'Payment not completed',
        data,
      };
    }
  }

  async handlePaystackWebhook(signature: string, payload: any) {
    const secretKey = this.getPaystackSecretKey();

    const hash = crypto
      .createHmac('sha512', secretKey)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (hash !== signature) {
      throw new ForbiddenException('Invalid Paystack webhook signature');
    }

    if (payload.event === 'charge.success') {
      const reference = payload.data.reference;
      const payment = await this.prisma.payment.findFirst({
        where: { transactionId: reference },
      });

      if (payment && payment.status !== PaymentStatus.COMPLETED) {
        await this.prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.COMPLETED,
              paymentMethod: payload.data.channel || 'paystack',
            },
          });

          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              status: OrderStatus.PROCESSING,
            },
          });
        });
      }
    }

    return { status: true };
  }

  async findByOrderId(userId: string, role: Role, orderId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            userId: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment record for order ${orderId} not found`);
    }

    if (role !== Role.ADMIN && payment.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return payment;
  }

  async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.payment.count(),
    ]);

    return {
      data: payments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async refund(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            orderItems: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException(
        `Only completed payments can be refunded. Current status is ${payment.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Mark payment as REFUNDED
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.REFUNDED },
      });

      // 2. Mark order as CANCELLED
      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: OrderStatus.CANCELLED },
      });

      // 3. Restore product stock
      for (const item of payment.order.orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }

      return updatedPayment;
    });
  }
}
