import { LoginSchema, type LoginInput } from "@eventboard/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { Button } from "../../../components/ui/Button";
import { ApiError } from "../../../lib/api-client";
import { ROUTES } from "../../../router/routes";
import { useLogin } from "../hooks/useLogin";

/**
 * P-01 ログイン画面（`/login`）。未ログイン時のエントリーポイントであり、`AppLayout`の外側に配置される
 * （router/index.tsx参照。本コンポーネントは組み込み先を意識せず単体で完結させる）。
 */
export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      await login.mutateAsync(data);
      navigate(ROUTES.home);
    } catch (error) {
      // WHY: 401（メールアドレス・パスワード不一致、または無効化済みアカウント）は
      // フィールド単位ではなくフォーム全体のエラーとして表示する（サーバー側は文言を1つしか返さないため）。
      if (error instanceof ApiError && error.status === 401) {
        setError("root", { message: error.message });
        return;
      }
      throw error;
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-slate-900">EventBoard ログイン</h1>

        <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
          {errors.root && (
            <p role="alert" className="text-sm text-red-600">
              {errors.root.message}
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="login-email">
              メールアドレス
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              {...register("email")}
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="login-password">
              パスワード
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              {...register("password")}
            />
            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
          </div>

          <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
            ログイン
          </Button>
        </form>
      </div>
    </div>
  );
}
