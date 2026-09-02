import { CreateFeedbackSchema } from "@eventboard/shared";
import { createZodDto } from "nestjs-zod";

/** POST /events/:id/feedbacks のリクエストボディDTO */
export class CreateFeedbackDto extends createZodDto(CreateFeedbackSchema) {}
