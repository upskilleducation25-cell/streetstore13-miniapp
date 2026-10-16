import { ApiProperty } from "@nestjs/swagger";
import type { AuthResponse, AuthUser } from "@ss13/shared";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class TelegramAuthDto {
  @ApiProperty({
    description: "Сирий рядок Telegram.WebApp.initData (не initDataUnsafe)",
    example: "query_id=AAH...&user=%7B%22id%22%3A1%7D&auth_date=1790000000&hash=abc...",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  initData!: string;
}

export class AuthUserDto implements AuthUser {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ description: "Telegram ID рядком", example: "777000111" }) telegramId!: string;
  @ApiProperty({ type: String, nullable: true }) username!: string | null;
  @ApiProperty({ type: String, nullable: true }) firstName!: string | null;
  @ApiProperty({ type: String, nullable: true }) lastName!: string | null;
}

export class AuthResponseDto implements AuthResponse {
  @ApiProperty({ description: "JWT для заголовка Authorization: Bearer <token>" }) token!: string;
  @ApiProperty({ description: "Час життя токена, секунд", example: 604800 }) expiresIn!: number;
  @ApiProperty({ type: AuthUserDto }) user!: AuthUserDto;
}
