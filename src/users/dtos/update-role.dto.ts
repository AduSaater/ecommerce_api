import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({ enum: Role, example: Role.ADMIN, description: 'User role' })
  @IsEnum(Role, { message: 'Role must be either USER or ADMIN' })
  @IsNotEmpty()
  role: Role;
}
