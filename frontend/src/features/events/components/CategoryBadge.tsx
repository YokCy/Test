import { cva } from "class-variance-authority";

import type { CategorySummary } from "../api";

// WHY(CODING_STANDARDS.md 2章「スタイリング」): 色の組み合わせをcvaで一元管理する。
// カテゴリマスタ（P-09）はadminが自由に追加できるため、未知のカテゴリ名は`その他`と同じ配色にフォールバックする。
const categoryBadgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", {
  variants: {
    category: {
      勉強会: "bg-blue-100 text-blue-700",
      懇親会: "bg-pink-100 text-pink-700",
      講演会: "bg-purple-100 text-purple-700",
      研修: "bg-amber-100 text-amber-700",
      その他: "bg-slate-100 text-slate-700",
    },
  },
  defaultVariants: {
    category: "その他",
  },
});

type KnownCategoryName = "勉強会" | "懇親会" | "講演会" | "研修" | "その他";
const KNOWN_CATEGORY_NAMES: readonly KnownCategoryName[] = ["勉強会", "懇親会", "講演会", "研修", "その他"];

function toKnownCategoryName(name: string): KnownCategoryName {
  const known = KNOWN_CATEGORY_NAMES.find((candidate) => candidate === name);
  return known ?? "その他";
}

type CategoryBadgeProps = {
  category: CategorySummary;
};

/** カテゴリ名バッジ（画面設計仕様.md 3.1.2/3.1.3の`🏷 カテゴリ名`表示）。 */
export function CategoryBadge({ category }: CategoryBadgeProps) {
  return (
    <span className={categoryBadgeVariants({ category: toKnownCategoryName(category.name) })}>
      <span aria-hidden="true">🏷</span>
      {category.name}
    </span>
  );
}
