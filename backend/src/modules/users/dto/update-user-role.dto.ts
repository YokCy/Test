import { UpdateUserRoleSchema } from "@eventboard/shared";
import { createZodDto } from "nestjs-zod";


/**
 * PUT /users/:id/role のリクエストボディDTO。
 * `packages/shared`のZodスキーマをそのまま`createZodDto()`でDTO化したもの（CODING_STANDARDS 3章「バリデーション」）。
 * DTO自体は形（shape）検証のみを担い、業務ルール（唯一のAdmin降格禁止等）はUsersServiceで検証する。
 */
export class UpdateUserRoleDto extends createZodDto(UpdateUserRoleSchema) {}
