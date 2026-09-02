const STAR_VALUES = [1, 2, 3, 4, 5] as const;

type StarRatingInputProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

/**
 * 1〜5のクリック式星評価入力。RHFの`Controller`経由（`value`/`onChange`のみを介する制御コンポーネント）で
 * 組み込むことを想定し、`register`互換の内部stateは持たない（画面設計仕様.md 3.1.7節）。
 */
export function StarRatingInput({ value, onChange, disabled }: StarRatingInputProps) {
  return (
    <div role="radiogroup" aria-label="評価" className="flex gap-1">
      {STAR_VALUES.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star}`}
          disabled={disabled}
          onClick={() => onChange(star)}
          className="text-2xl leading-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={star <= value ? "text-yellow-400" : "text-slate-300"}>★</span>
        </button>
      ))}
    </div>
  );
}
