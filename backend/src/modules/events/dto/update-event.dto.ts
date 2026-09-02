import { UpdateEventSchema } from "@eventboard/shared";
import { createZodDto } from "nestjs-zod";

/** PUT /events/:id のリクエストボディDTO（作成時と同じ項目の部分更新） */
export class UpdateEventDto extends createZodDto(UpdateEventSchema) {}
