import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PublicPrismaService } from './public-prisma.service';

@Global()
@Module({ providers: [PrismaService, PublicPrismaService], exports: [PrismaService, PublicPrismaService] })
export class PrismaModule {}
