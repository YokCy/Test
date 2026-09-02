import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { PrismaService } from "../../prisma/prisma.service";

import { CategoriesService } from "./categories.service";

/** Prismaの既知エラー（P2002/P2025/P2003）を再現するためのヘルパー */
function prismaKnownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("mocked prisma error", {
    code,
    clientVersion: "5.0.0",
  });
}

describe("CategoriesService", () => {
  let service: CategoriesService;
  let prisma: {
    category: { findMany: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      category: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new CategoriesService(prisma as unknown as PrismaService);
  });

  describe("findAll", () => {
    it("一覧を取得し、各要素にeventCountを含めて返す", async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: "cat-1", name: "勉強会", _count: { events: 3 } },
        { id: "cat-2", name: "懇親会", _count: { events: 0 } },
      ]);

      const result = await service.findAll();

      expect(result).toEqual([
        { id: "cat-1", name: "勉強会", eventCount: 3 },
        { id: "cat-2", name: "懇親会", eventCount: 0 },
      ]);
    });

    it("eventCountの集計に論理削除済みEventを除外するwhere条件を付与していないこと", async () => {
      prisma.category.findMany.mockResolvedValue([]);

      await service.findAll();

      // _count.select.eventsに deletedAt を条件にした絞り込みが無いことを検証し、
      // 論理削除済みのEventも含めてカウントされる実装であることを担保する
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        orderBy: { name: "asc" },
        include: { _count: { select: { events: true } } },
      });
    });
  });

  describe("create", () => {
    it("カテゴリが新規作成される", async () => {
      const created = { id: "cat-1", name: "勉強会" };
      prisma.category.create.mockResolvedValue(created);

      const result = await service.create({ name: "勉強会" });

      expect(prisma.category.create).toHaveBeenCalledWith({ data: { name: "勉強会" } });
      expect(result).toEqual(created);
    });

    it("同名カテゴリが既に存在する場合、ConflictExceptionを投げる", async () => {
      prisma.category.create.mockRejectedValue(prismaKnownError("P2002"));

      await expect(service.create({ name: "勉強会" })).rejects.toThrow(ConflictException);
    });

    it("Prismaの既知エラー以外（想定外エラー）はそのまま再スローされる", async () => {
      const unexpectedError = new Error("想定外のDB接続エラー");
      prisma.category.create.mockRejectedValue(unexpectedError);

      await expect(service.create({ name: "勉強会" })).rejects.toThrow(unexpectedError);
    });
  });

  describe("update", () => {
    it("名前が更新される", async () => {
      const updated = { id: "cat-1", name: "更新後の名前" };
      prisma.category.update.mockResolvedValue(updated);

      const result = await service.update("cat-1", { name: "更新後の名前" });

      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: "cat-1" },
        data: { name: "更新後の名前" },
      });
      expect(result).toEqual(updated);
    });

    it("同名カテゴリが既に存在する場合、ConflictExceptionを投げる", async () => {
      prisma.category.update.mockRejectedValue(prismaKnownError("P2002"));

      await expect(service.update("cat-1", { name: "既存の名前" })).rejects.toThrow(ConflictException);
    });

    it("存在しないidの場合、NotFoundExceptionを投げる", async () => {
      prisma.category.update.mockRejectedValue(prismaKnownError("P2025"));

      await expect(service.update("missing-cat", { name: "任意の名前" })).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("紐づくEventが無い場合、削除される", async () => {
      prisma.category.delete.mockResolvedValue({ id: "cat-1", name: "勉強会" });

      await service.remove("cat-1");

      expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: "cat-1" } });
    });

    it("紐づくEventが1件でも存在する場合、ConflictExceptionを投げる", async () => {
      prisma.category.delete.mockRejectedValue(prismaKnownError("P2003"));

      await expect(service.remove("cat-1")).rejects.toThrow(ConflictException);
    });

    it("存在しないidの場合、NotFoundExceptionを投げる", async () => {
      prisma.category.delete.mockRejectedValue(prismaKnownError("P2025"));

      await expect(service.remove("missing-cat")).rejects.toThrow(NotFoundException);
    });
  });
});
