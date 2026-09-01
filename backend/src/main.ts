import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { ZodValidationPipe } from "nestjs-zod";

import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Access/Refresh TokenをhttpOnly Cookieで受け渡すため、Cookie解析ミドルウェアを有効化する
  // （CODING_STANDARDS 9章「認証トークン」）
  app.use(cookieParser());

  // ローカル開発ではフロントエンド(Vite dev server)からのCookie付きリクエストを許可する
  app.enableCors({
    origin: process.env.APP_BASE_URL ?? "http://localhost:5173",
    credentials: true,
  });

  // 全リクエストボディをpackages/shared由来のZodスキーマで検証する（CODING_STANDARDS 3章「バリデーション」）。
  // 各モジュールのDTOは`nestjs-zod`の`createZodDto()`でZodスキーマから生成したものを使う。
  app.useGlobalPipes(new ZodValidationPipe());

  // レスポンス形式をAPI全体で統一する（5章「API設計規約」）
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
