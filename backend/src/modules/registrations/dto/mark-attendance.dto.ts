import { MarkAttendanceSchema } from "@eventboard/shared";
import { createZodDto } from "nestjs-zod";

/** PUT /events/:id/registrations/:userId/attendance のリクエストボディDTO */
export class MarkAttendanceDto extends createZodDto(MarkAttendanceSchema) {}
