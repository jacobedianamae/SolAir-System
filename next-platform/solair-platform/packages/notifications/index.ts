export type NotificationCategory = "security" | "alert" | "energy" | "system" | "assistance" | "message";
export type ActivityNotification = {
  id: string;
  revision: string;
  category: NotificationCategory;
  title: string;
  body: string;
  created_at: string;
  source: "hardware" | "demo" | "system";
  vehicle_id: string | null;
  page: string;
};
