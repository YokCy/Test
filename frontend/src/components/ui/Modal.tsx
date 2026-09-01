import { useEffect, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string | undefined;
  children: ReactNode;
  /** E2E（Playwright）が`page.getByTestId`でモーダルの開閉を判定するための任意識別子。 */
  testId?: string | undefined;
};

/**
 * MANIFEST.md 3.1節「タスクの作成・編集はモーダルで行い、画面遷移を発生させない」方針の基盤となる
 * モーダル基盤コンポーネント。M-01〜M-08の各モーダルはこれをラップして実装する。
 */
export function Modal({ isOpen, onClose, title, children, testId }: ModalProps) {
  // WHY: モーダル表示中に背景がスクロールできてしまうと、背後のカンバンボード等が動いて
  // モーダルとの位置関係が崩れるため、開いている間はbodyのスクロールをロックする。
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const stopPropagation = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return createPortal(
    <div
      data-testid={testId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      {/* 内容が画面高を超える場合はこの内側パネルのみをスクロールさせ、外枠は中央固定のままにする */}
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={stopPropagation}
      >
        {title && (
          <div className="shrink-0 border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
