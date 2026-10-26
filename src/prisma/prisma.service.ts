import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        console.log('PrismaService: constructor called. DB URL defined:', !!process.env.DATABASE_URL);
        const adapter = new PrismaPg({
            connectionString: process.env.DATABASE_URL
        })
        super({
            adapter,
            log: process.env.NODE_ENV === "development" ? ['query', 'error', 'warn'] : ['error']
        })
    }
    async onModuleInit() {
        console.log('PrismaService: connecting to database via $connect()...');
        await this.$connect();
        console.log('PrismaService: database connected successfully!');
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
    async cleanDatabase() {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Cannot clean database in production environment');
        };

        const models = Reflect.ownKeys(this).filter(
            (key) => typeof key === 'string' && !key.startsWith('_')
        );

        return Promise.all(
            models.map((modelKey) => {
                if (typeof modelKey === 'string' && typeof (this as any)[modelKey]?.deleteMany === 'function') {
                    return (this as any)[modelKey].deleteMany();
                }
            })
        );
    }
}
