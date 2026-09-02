import { UpdateCategorySchema } from "@eventboard/shared";
import { createZodDto } from "nestjs-zod";

/** PUT /categories/:id のリクエストボディDTO */
export class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}
