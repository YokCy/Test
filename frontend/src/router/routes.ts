// 画面仕様確定後にここへイベント関連ルートを追加していく。
// マジックストリングの散在を避け、Header等のナビゲーション導線から参照する。
export const ROUTES = {
  login: "/login",
  // TODO: イベント一覧画面の実装後、正式なホーム（"/"）に差し替える
  home: "/settings/profile",
  profile: "/settings/profile",
} as const;
