import { useState } from "react";

import { Button } from "../../../../components/ui/Button";
import { Spinner } from "../../../../components/ui/Spinner";
import type { CategoryListItem } from "../api";
import { useCategories } from "../hooks/useCategories";

import { CategoryFormModal } from "./CategoryFormModal";
import { DeleteCategoryConfirmModal } from "./DeleteCategoryConfirmModal";

/** `CategoryFormModal`の開閉・モードを1つの状態にまとめる（"closed"＝非表示、"create"＝追加モード、対象カテゴリ＝編集モード）。 */
type FormState = "closed" | "create" | CategoryListItem;

/**
 * P-09 カテゴリマスタ管理画面（`/admin/categories`）。画面設計仕様.md 3.1.8節・MANIFEST.md 6章 #10-#13。
 * カテゴリ一覧（`GET /categories`）＋追加・編集（M-01）・削除（M-03）を提供する。
 *
 * WHY(ルーティング): 本コンポーネント自体はadminのみアクセス可能という制約を持たず、あくまで
 * `<AdminRoute />`配下にネストされることでその制約を満たす想定（`router/AdminRoute.tsx`参照）。
 * `router/index.tsx`・`router/routes.ts`は本featureの管轄外のため、ルート定義自体はここでは行わない。
 */
export function CategoriesAdminPage() {
  const { data: categories, isPending, isError } = useCategories();
  const [formState, setFormState] = useState<FormState>("closed");
  const [deleteTarget, setDeleteTarget] = useState<CategoryListItem | null>(null);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">カテゴリマスタ管理</h1>
        <Button
          onClick={() => {
            setFormState("create");
          }}
        >
          ＋追加
        </Button>
      </div>

      {isPending && <Spinner />}
      {isError && <p className="text-sm text-red-600">カテゴリ一覧の取得に失敗しました。</p>}

      {categories && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4 font-medium">カテゴリ名</th>
              <th className="py-2 pr-4 font-medium">紐づくイベント数</th>
              <th className="py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="border-b border-slate-100">
                <td className="py-2 pr-4">{category.name}</td>
                <td className="py-2 pr-4">{category.eventCount}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setFormState(category);
                      }}
                    >
                      編集
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setDeleteTarget(category);
                      }}
                    >
                      削除
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <CategoryFormModal
        isOpen={formState !== "closed"}
        initialValue={formState === "closed" || formState === "create" ? undefined : formState}
        onClose={() => {
          setFormState("closed");
        }}
      />

      <DeleteCategoryConfirmModal
        isOpen={deleteTarget !== null}
        category={deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
