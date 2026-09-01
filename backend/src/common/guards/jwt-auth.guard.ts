import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Access Token（httpOnly Cookie）による認証を要求するGuard。
 * `JwtStrategy`（"jwt"戦略）の検証結果を`request.user`に格納する。
 * CODING_STANDARDS 9章「認可」に従い、保護対象の全エンドポイントに付与する。
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
