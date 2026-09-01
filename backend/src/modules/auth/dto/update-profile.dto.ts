import { UpdateProfileSchema } from "@eventboard/shared";
import { createZodDto } from "nestjs-zod";

/** PUT /auth/profile のリクエストボディDTO */
export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
