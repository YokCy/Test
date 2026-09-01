import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

/**
 * 全APIの成功レスポンスを { success: true, data } 形式に統一するインターセプター。
 * CODING_STANDARDS 5章「レスポンス形式」に従い、Controller側でのレスポンス整形を不要にする。
 * 集計値を伴う一覧API（例: GET /users/me/tasks）はService側でdataの形（{ tasks, counts }等）を
 * 組み立てて返す想定のため、本インターセプターはその結果をそのままdataに包むだけに留める。
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, { success: true; data: T }> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<{ success: true; data: T }> {
    return next.handle().pipe(map((data) => ({ success: true, data })));
  }
}
