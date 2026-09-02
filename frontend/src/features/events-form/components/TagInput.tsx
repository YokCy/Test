import { useState, type KeyboardEvent } from "react";

type TagInputProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  id?: string | undefined;
};

/** Enter・カンマ・入力欄からのフォーカス外しのいずれかでドラフト中の文字列をタグとして確定する。 */
const COMMIT_KEYS = ["Enter", ","];

/**
 * チップ入力欄（画面設計仕様.md 3.1.4「タグ [react ×][frontend ×][＋タグを追加]」）。
 * `string[]`をそのまま読み書きする制御コンポーネントとして実装し、EventForm側では
 * react-hook-formの`Controller`経由で`tags`フィールドに接続する。
 */
export function TagInput({ value, onChange, id }: TagInputProps) {
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    // WHY: カンマ区切りで確定されるケースでは末尾にカンマが残ったまま渡ってくるため取り除く。
    const tag = draft.trim().replace(/,$/, "").trim();
    if (tag.length > 0 && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (COMMIT_KEYS.includes(event.key)) {
      event.preventDefault();
      commitDraft();
      return;
    }
    // WHY: 入力欄が空の状態でBackspaceを押した場合、直前のタグを削除できるようにする
    // （チップの多いタグ入力UIで一般的な挙動）。
    if (event.key === "Backspace" && draft.length === 0 && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((existing) => existing !== tag));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1.5 focus-within:ring-1 focus-within:ring-blue-500">
      {value.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            aria-label={`タグ「${tag}」を削除`}
            className="text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder={value.length === 0 ? "タグを入力してEnter" : "＋タグを追加"}
        className="min-w-[8rem] flex-1 border-none p-0.5 text-sm outline-none focus:ring-0"
      />
    </div>
  );
}
