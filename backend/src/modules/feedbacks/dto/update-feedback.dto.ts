import { UpdateFeedbackSchema } from "@eventboard/shared";
import { createZodDto } from "nestjs-zod";

/** PUT /feedbacks/:id のリクエストボディDTO */
export class UpdateFeedbackDto extends createZodDto(UpdateFeedbackSchema) {}
