import { CreateEventSchema } from "@eventboard/shared";
import { createZodDto } from "nestjs-zod";

/** POST /events のリクエストボディDTO */
export class CreateEventDto extends createZodDto(CreateEventSchema) {}
