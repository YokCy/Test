import { ConflictException, NotFoundException } from "@nestjs/common";
import type { SystemRole, User } from "@prisma/client";

import type { PrismaService } from "../../prisma/prisma.service";

import { UsersService } from "./users.service";

describe("UsersService", () => {
  let service: UsersService;
  let prisma: {
    user: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; count: jest.Mock };
  };

  const buildUser = (overrides: Partial<User> = {}): User => ({
    id: "target-user",
    email: "member@example.com",
    name: "対象ユーザー",
    passwordHash: "hashed",
    role: "MEMBER",
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe("findAll", () => {
    it("一覧を取得し、passwordHashを含まないselect句でPrismaを呼び出す", async () => {
      const listItem = {
        id: "user-1",
        name: "山田太郎",
        email: "taro@example.com",
        role: "MEMBER" as SystemRole,
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      };
      prisma.user.findMany.mockResolvedValue([listItem]);

      const result = await service.findAll();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });
      expect(result).toEqual([listItem]);
    });
  });

  describe("findOne", () => {
    it("存在するidの場合、詳細情報を返す", async () => {
      const detail = {
        id: "user-1",
        name: "山田太郎",
        email: "taro@example.com",
        role: "MEMBER" as SystemRole,
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      };
      prisma.user.findUnique.mockResolvedValue(detail);

      const result = await service.findOne("user-1");

      expect(result).toEqual(detail);
    });

    it("存在しないidの場合、NotFoundExceptionを投げる", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne("missing-user")).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateRole", () => {
    it("MEMBERからADMINへ昇格できる（残存Admin検証は走らない）", async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ role: "MEMBER", isActive: true }));
      prisma.user.update.mockResolvedValue(buildUser({ role: "ADMIN" }));

      const result = await service.updateRole("target-user", { role: "ADMIN" });

      expect(prisma.user.count).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "target-user" },
        data: { role: "ADMIN" },
        select: { id: true, name: true, email: true, role: true },
      });
      expect(result.role).toBe("ADMIN");
    });

    it("ADMINからMEMBERへの降格で、他に有効なADMINが残っている場合は成功する", async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ role: "ADMIN", isActive: true }));
      prisma.user.count.mockResolvedValue(1);
      prisma.user.update.mockResolvedValue(buildUser({ role: "MEMBER" }));

      const result = await service.updateRole("target-user", { role: "MEMBER" });

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { role: "ADMIN", isActive: true, id: { not: "target-user" } },
      });
      expect(result.role).toBe("MEMBER");
    });

    it("唯一の有効ADMINをMEMBERへ降格しようとした場合、ConflictExceptionを投げる", async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ role: "ADMIN", isActive: true }));
      prisma.user.count.mockResolvedValue(0);

      await expect(service.updateRole("target-user", { role: "MEMBER" })).rejects.toThrow(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("対象が既にisActive=falseのADMINをMEMBERへ変更する場合、残存Admin数の検証は走らない", async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ role: "ADMIN", isActive: false }));
      prisma.user.update.mockResolvedValue(buildUser({ role: "MEMBER", isActive: false }));

      await service.updateRole("target-user", { role: "MEMBER" });

      expect(prisma.user.count).not.toHaveBeenCalled();
    });

    it("対象が既にMEMBERの場合（MEMBER→MEMBER）、残存Admin数の検証は走らない", async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ role: "MEMBER", isActive: true }));
      prisma.user.update.mockResolvedValue(buildUser({ role: "MEMBER" }));

      await service.updateRole("target-user", { role: "MEMBER" });

      expect(prisma.user.count).not.toHaveBeenCalled();
    });

    it("存在しないidの場合、NotFoundExceptionを投げる", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateRole("missing-user", { role: "ADMIN" })).rejects.toThrow(NotFoundException);
    });
  });

  describe("deactivate", () => {
    it("対象ユーザーが無効化される", async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ role: "MEMBER", isActive: true }));
      prisma.user.update.mockResolvedValue(buildUser({ isActive: false }));

      const result = await service.deactivate("target-user", "current-admin-user");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "target-user" },
        data: { isActive: false },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
      expect(result.isActive).toBe(false);
    });

    it("自分自身を対象にした場合、ConflictExceptionを投げる", async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ id: "current-admin-user" }));

      await expect(service.deactivate("current-admin-user", "current-admin-user")).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("唯一の有効ADMINを無効化しようとした場合、ConflictExceptionを投げる", async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ role: "ADMIN", isActive: true }));
      prisma.user.count.mockResolvedValue(0);

      await expect(service.deactivate("target-user", "current-admin-user")).rejects.toThrow(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("対象がADMINでも他に有効なADMINが残っている場合は無効化に成功する", async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ role: "ADMIN", isActive: true }));
      prisma.user.count.mockResolvedValue(1);
      prisma.user.update.mockResolvedValue(buildUser({ role: "ADMIN", isActive: false }));

      const result = await service.deactivate("target-user", "current-admin-user");

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { role: "ADMIN", isActive: true, id: { not: "target-user" } },
      });
      expect(result.isActive).toBe(false);
    });

    it("対象がMEMBERの場合、残存Admin数の検証は走らない", async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ role: "MEMBER", isActive: true }));
      prisma.user.update.mockResolvedValue(buildUser({ isActive: false }));

      await service.deactivate("target-user", "current-admin-user");

      expect(prisma.user.count).not.toHaveBeenCalled();
    });

    it("存在しないidの場合、NotFoundExceptionを投げる", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.deactivate("missing-user", "current-admin-user")).rejects.toThrow(NotFoundException);
    });
  });
});
