import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { TelegramAuthGuard } from "./telegram-auth.guard.js";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        secret: env.JWT_SECRET,
        signOptions: { expiresIn: env.JWT_EXPIRES_IN_SECONDS, algorithm: "HS256" },
        verifyOptions: { algorithms: ["HS256"] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TelegramAuthGuard],
  exports: [TelegramAuthGuard, JwtModule],
})
export class AuthModule {}
