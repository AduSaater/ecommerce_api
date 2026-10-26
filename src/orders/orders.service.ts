import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dtos/create-order.dto';
import { OrderStatus, Role } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomBytes(3).toString('hex').toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  async checkout(userId: string, dto: CreateOrderDto) {
    const cart = await this.prisma.cart.findFirst({
      where: {
        userId,
        checkedOut: false,
      },
      include: {
        cartItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart || cart.cartItems.length === 0) {
      throw new BadRequestException('Your cart is empty. Add products before checking out');
    }

    // Verify stock availability for all items
    for (const item of cart.cartItems) {
      if (!item.product.isActive) {
        throw new BadRequestException(
          `Product '${item.product.name}' is no longer available`,
        );
      }
      if (item.product.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for '${item.product.name}'. Available: ${item.product.stock}, requested: ${item.quantity}`,
        );
      }
    }

    const totalAmount = cart.cartItems.reduce((acc, item) => {
      return acc + Number(item.product.price) * item.quantity;
    }, 0);

    const orderNumber = this.generateOrderNumber();

    return this.prisma.$transaction(async (tx) => {
      // 1. Deduct stock for all products
      for (const item of cart.cartItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      // 2. Create the Order
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          cartId: cart.id,
          totalAmount,
          shippingAddress: dto.shippingAddress,
          status: OrderStatus.PENDING,
          orderItems: {
            create: cart.cartItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.product.price,
            })),
          },
          payment: {
            create: {
              userId,
              amount: totalAmount,
              currency: 'usd',
              status: 'PENDING',
            },
          },
        },
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  imageUrl: true,
                },
              },
            },
          },
          payment: true,
        },
      });

      // 3. Mark the cart as checked out
      await tx.cart.update({
        where: { id: cart.id },
        data: { checkedOut: true },
      });

      return order;
    });
  }

  async findAll(
    userId: string,
    role: Role,
    status?: OrderStatus,
    page = 1,
    limit = 10,
  ) {
    const skip = (page - 1) * limit;
    const where = {
      ...(role !== Role.ADMIN && { userId }),
      ...(status && { status }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  imageUrl: true,
                },
              },
            },
          },
          payment: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(userId: string, role: Role, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                imageUrl: true,
              },
            },
          },
        },
        payment: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (role !== Role.ADMIN && order.userId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return order;
  }

  async updateStatus(orderId: string, newStatus: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // If changing to CANCELLED and it wasn't CANCELLED before, restore stock
    if (newStatus === OrderStatus.CANCELLED && order.status !== OrderStatus.CANCELLED) {
      return this.prisma.$transaction(async (tx) => {
        for (const item of order.orderItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }

        return tx.order.update({
          where: { id: orderId },
          data: { status: newStatus },
          include: {
            orderItems: true,
            payment: true,
          },
        });
      });
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
      include: {
        orderItems: true,
        payment: true,
      },
    });
  }

  async cancelOrder(userId: string, role: Role, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (role !== Role.ADMIN && order.userId !== userId) {
      throw new ForbiddenException('You cannot cancel an order that does not belong to you');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'Delivered orders cannot be cancelled. Use the refund endpoint instead',
      );
    }

    if (role !== Role.ADMIN && order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Customers can only cancel orders with status PENDING. Current status is ${order.status}. Please contact an administrator for assistance.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of order.orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }

      return tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
        include: {
          orderItems: true,
          payment: true,
        },
      });
    });
  }
}
