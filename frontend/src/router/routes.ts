// マジックストリングの散在を避け、Header等のナビゲーション導線から参照する。
export const ROUTES = {
  login: "/login",
  home: "/events",
  profile: "/settings/profile",
  events: "/events",
  eventDetail: "/events/:eventId",
  eventCreate: "/events/new",
  eventEdit: "/events/:eventId/edit",
  eventAttendance: "/events/:eventId/attendance",
  eventFeedback: "/events/:eventId/feedback",
  myPage: "/my-page",
  adminCategories: "/admin/categories",
} as const;
