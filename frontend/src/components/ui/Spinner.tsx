const SIZE_CLASSES = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]",
} as const;

type SpinnerProps = {
  size?: keyof typeof SIZE_CLASSES;
};

/** ローディング表示用の共通スピナー。API通信中のボタン・画面読み込み中の表示に使う。 */
export function Spinner({ size = "md" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="読み込み中"
      className={`inline-block animate-spin rounded-full border-current border-t-transparent ${SIZE_CLASSES[size]}`}
    />
  );
}
