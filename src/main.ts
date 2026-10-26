import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('🚀 Bootstrapping NestJS application...');
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Global prefix
  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('E-Commerce REST API')
    .setDescription(
      'Comprehensive, production-ready E-Commerce Backend API featuring JWT Authentication with Refresh Tokens, RBAC (Role-Based Access Control), Product Catalog, Categories, Shopping Cart, Orders, and Payment Workflows.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Input your Bearer JWT token to access authorized endpoints',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'Registration, Login, Refresh Token, and Logout')
    .addTag('Users', 'User profile management & Admin user controls')
    .addTag('Categories', 'Product category catalog & management')
    .addTag('Products', 'Product inventory, search, and filtering')
    .addTag('Cart', 'Customer shopping cart operations')
    .addTag('Orders', 'Checkout, order history, and lifecycle status updates')
    .addTag('Payments', 'Payment simulation, transaction tracking, and refunds')
    .addTag('Uploads', 'Image uploads to Cloudinary for products and categories')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tagsSorter: 'alpha',
    },
    customSiteTitle: 'E-Commerce API Documentation',
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
  console.log(`📖 Swagger UI Documentation: http://localhost:${port}/docs`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application', error);
  process.exit(1);
});