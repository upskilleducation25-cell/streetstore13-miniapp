import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: "ok"; db: "ok" }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: "error", db: "unavailable" });
    }
    return { status: "ok", db: "ok" };
  }
}
