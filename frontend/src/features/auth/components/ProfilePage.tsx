import { UpdateProfileSchema, type UpdateProfileInput } from "@eventboard/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { Spinner } from "../../../components/ui/Spinner";
import { useToast } from "../../../components/ui/Toast";
import { ApiError } from "../../../lib/api-client";
import { useMe } from "../hooks/useMe";
import { useUpdateProfile } from "../hooks/useUpdateProfile";

/**
 * P-07 プロフィール設定画面（`/settings/profile`）。
 * 更新成功時は`useUpdateProfile`が`useMe`のキャッシュを書き換えるため、Header等の氏名表示は
 * このコンポーネントから明示的に何かを呼ばなくても自動的に再検証される。
 */
export function ProfilePage() {
  const { data: me, isLoading } = useMe();
  const updateProfile = useUpdateProfile();
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: { name: "" },
  });

  // WHY: useMeの取得完了タイミングはこのコンポーネントのマウントより後になり得るため、
  // データが揃った時点でフォームの初期値を反映する。
  useEffect(() => {
    if (me) {
      reset({ name: me.name });
    }
  }, [me, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      await updateProfile.mutateAsync(data);
      showToast("プロフィールを更新しました", "success");
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setError("root", { message: error.message });
        return;
      }
      throw error;
    }
  });

  if (isLoading || !me) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-900">プロフィール設定</h1>

      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
        {errors.root && (
          <p role="alert" className="text-sm text-red-600">
            {errors.root.message}
          </p>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="profile-email">
            メールアドレス
          </label>
          {/* メールアドレスはPUT /auth/profileの更新対象外（MANIFEST.md 6章）のため表示のみ */}
          <input
            id="profile-email"
            value={me.email}
            disabled
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="profile-name">
            表示名
          </label>
          <input
            id="profile-name"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            {...register("name")}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>

        <div className="mt-2 flex justify-end">
          <Button type="submit" isLoading={isSubmitting}>
            更新する
          </Button>
        </div>
      </form>
    </div>
  );
}
