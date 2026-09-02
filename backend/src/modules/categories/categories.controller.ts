import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from "@nestjs/common";

import { CheckPolicies } from "../../common/casl/check-policies.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PoliciesGuard } from "../../common/guards/policies.guard";

import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

/**
 * カテゴリマスタ管理API（`/categories/*`）。MANIFEST.md 6章の通り、閲覧は全ロール、
 * 追加・編集・削除はadminのみ（`ability.factory.ts`でadminのみに`manage`を付与しているため、
 * memberの書き込み系リクエストはPoliciesGuardで403になる）。
 */
@Controller("categories")
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /** カテゴリ一覧を取得する（MANIFEST.md 6章 GET /categories） */
  @Get()
  @CheckPolicies((ability) => ability.can("read", "Category"))
  findAll() {
    return this.categoriesService.findAll();
  }

  /** カテゴリを新規追加する（MANIFEST.md 6章 POST /categories） */
  @Post()
  @CheckPolicies((ability) => ability.can("create", "Category"))
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  /** カテゴリ名を編集する（MANIFEST.md 6章 PUT /categories/:id） */
  @Put(":id")
  @CheckPolicies((ability) => ability.can("update", "Category"))
  update(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  /** カテゴリを削除する（MANIFEST.md 6章 DELETE /categories/:id） */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckPolicies((ability) => ability.can("delete", "Category"))
  remove(@Param("id") id: string) {
    return this.categoriesService.remove(id);
  }
}
