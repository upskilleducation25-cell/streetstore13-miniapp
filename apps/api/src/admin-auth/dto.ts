import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  AdminCreateInput,
  AdminLoginInput,
  AdminUpdateInput,
  ChangePasswordInput,
} from "@ss13/shared";
import { ADMIN_PASSWORD_LIMITS } from "@ss13/shared";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

import { AdminRole } from "../generated/prisma/client.js";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const lower = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

export class AdminLoginDto implements AdminLoginInput {
  @ApiProperty({ example: "owner@example.com" })
  @Transform(lower)
  @IsEmail({}, { message: "Некоректний email" })
  @MaxLength(254)
  email!: string;

  // Довжину тут не обмежуємо знизу: слабкий пароль при вході — просто невірний пароль.
  @ApiProperty({ format: "password" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(ADMIN_PASSWORD_LIMITS.max)
  password!: string;
}

export class ChangePasswordDto implements ChangePasswordInput {
  @ApiProperty({ format: "password" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(ADMIN_PASSWORD_LIMITS.max)
  currentPassword!: string;

  @ApiProperty({ format: "password", minLength: ADMIN_PASSWORD_LIMITS.min })
  @IsString()
  @MinLength(ADMIN_PASSWORD_LIMITS.min)
  @MaxLength(ADMIN_PASSWORD_LIMITS.max)
  newPassword!: string;
}

export class AdminCreateDto implements AdminCreateInput {
  @ApiProperty({ example: "manager@example.com" })
  @Transform(lower)
  @IsEmail({}, { message: "Некоректний email" })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: "Олена" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: AdminRole })
  @IsEnum(AdminRole)
  role!: AdminRole;

  @ApiProperty({ format: "password", minLength: ADMIN_PASSWORD_LIMITS.min })
  @IsString()
  @MinLength(ADMIN_PASSWORD_LIMITS.min)
  @MaxLength(ADMIN_PASSWORD_LIMITS.max)
  password!: string;
}

export class AdminUpdateDto implements AdminUpdateInput {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: AdminRole })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ format: "password", minLength: ADMIN_PASSWORD_LIMITS.min })
  @IsOptional()
  @IsString()
  @MinLength(ADMIN_PASSWORD_LIMITS.min)
  @MaxLength(ADMIN_PASSWORD_LIMITS.max)
  password?: string;
}
