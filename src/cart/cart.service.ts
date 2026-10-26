import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToCartDto } from './dtos/add-to-cart.dto';
import { UpdateCartItemDto } from './dtos/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateCart(userId: string) {
    let cart = await this.prisma.cart.findFirst({
      where: {
        userId,
        checkedOut: false,
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          userId,
          checkedOut: false,
        },
      });
    }

    return cart;
  }

  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    const fullCart = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        cartItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                stock: true,
                sku: true,
                imageUrl: true,
                isActive: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!fullCart) {
      throw new NotFoundException('Cart not found');
    }

    const items = fullCart.cartItems.map((item) => {
      const priceNum = Number(item.product.price);
      const subtotal = Number((priceNum * item.quantity).toFixed(2));
      return {
        id: item.id,
        quantity: item.quantity,
        product: item.product,
        subtotal,
      };
    });

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = Number(
      items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2),
    );

    return {
      id: fullCart.id,
      userId: fullCart.userId,
      items,
      totalQuantity,
      totalAmount,
    };
  }

  async addItem(userId: string, dto: AddToCartDto) {
    const quantity = dto.quantity ?? 1;

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found or unavailable');
    }

    if (product.stock < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available stock: ${product.stock}`,
      );
    }

    const cart = await this.getOrCreateCart(userId);

    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        productId_cartId: {
          productId: dto.productId,
          cartId: cart.id,
        },
      },
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (product.stock < newQuantity) {
        throw new BadRequestException(
          `Cannot add ${quantity} more. Total in cart would exceed available stock (${product.stock})`,
        );
      }

      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          quantity,
        },
      });
    }

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const cart = await this.getOrCreateCart(userId);

    const cartItem = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { product: true },
    });

    if (!cartItem || cartItem.cartId !== cart.id) {
      throw new NotFoundException('Item not found in your cart');
    }

    if (cartItem.product.stock < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available stock: ${cartItem.product.stock}`,
      );
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getOrCreateCart(userId);

    const cartItem = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
    });

    if (!cartItem || cartItem.cartId !== cart.id) {
      throw new NotFoundException('Item not found in your cart');
    }

    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return this.getCart(userId);
  }
}
