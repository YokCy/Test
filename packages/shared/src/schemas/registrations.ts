import { z } from "zod";

/**
 * 出席マークAPI（`PUT /events/:id/registrations/:userId/attendance`）のリクエストスキーマ
 * （MANIFEST.md 6章 #22）。
 */
export const MarkAttendanceSchema = z.object({
  attendanceStatus: z.enum(["ATTENDED", "ABSENT"]),
});
export type MarkAttendanceInput = z.infer<typeof MarkAttendanceSchema>;

/**
 * キャンセルAPI（`POST /events/:id/cancel`）のリクエストスキーマ（MANIFEST.md 6章 #20）。
 * `userId`はadminが本人以外を強制キャンセルする場合のみ指定する（未指定時は実行者本人が対象）。
 */
export const CancelRegistrationSchema = z.object({
  userId: z.string().cuid().optional(),
});
export type CancelRegistrationInput = z.infer<typeof CancelRegistrationSchema>;
