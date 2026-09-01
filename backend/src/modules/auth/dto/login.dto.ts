import { LoginSchema } from "@eventboard/shared";
import { createZodDto } from "nestjs-zod";

/** POST /auth/login のリクエストボディDTO */
export class LoginDto extends createZodDto(LoginSchema) {}
