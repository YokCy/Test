import { CancelRegistrationSchema } from "@eventboard/shared";
import { createZodDto } from "nestjs-zod";

/** POST /events/:id/cancel のリクエストボディDTO */
export class CancelRegistrationDto extends createZodDto(CancelRegistrationSchema) {}
