import { CreateCategorySchema } from "@eventboard/shared";
import { createZodDto } from "nestjs-zod";

/** POST /categories のリクエストボディDTO */
export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}
