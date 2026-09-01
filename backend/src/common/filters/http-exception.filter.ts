import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import type { Response } from "express";

/**
 * 全APIエラーレスポンスを { success: false, error: { code, message } } 形式に統一するフィルター。
 * CODING_STANDARDS 3章「エラーハンドリング」に従い、各Controller/Serviceで個別にレスポンス整形しないための一元化。
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    const body = exception.getResponse();

    response.status(status).json({
      success: false,
      error: {
        code: exception.name,
        message: typeof body === "string" ? body : (body as { message: string }).message,
      },
    });
  }
}
