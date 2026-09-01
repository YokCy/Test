import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { Spinner } from "./Spinner";

// WHY(CODING_STANDARDS.md 2章「スタイリング」): 色・サイズの組み合わせが画面ごとに散らばらないよう、
// cvaでバリアントを一元管理する（primary=主操作、secondary=補助操作、danger=廃棄/無効化等の破壊的操作）。
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-blue-600 text-white hover:bg-blue-700",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
        danger: "bg-red-600 text-white hover:bg-red-700",
        ghost: "text-slate-600 hover:bg-slate-100",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** trueの間、クリック不可にしつつSpinnerを表示する（API送信中の二重送信防止に使う） */
    isLoading?: boolean | undefined;
  };

export function Button({ variant, size, isLoading, disabled, className, children, ...props }: ButtonProps) {
  return (
    <button
      className={[buttonVariants({ variant, size }), className].filter(Boolean).join(" ")}
      disabled={disabled ?? isLoading}
      {...props}
    >
      {isLoading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
