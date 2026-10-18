import type { Telemetry } from "../packages/telemetry-contract";
export type Vehicle = {
  id: string;
  name: string;
  model: string;
  image_url: string;
  driver_name: string | null;
  driver_display_name?:string|null;
  driver_id: string | null;
  device_id: string | null;
  status: string;
  nominal_voltage: number;
  nominal_capacity: number;
  solar_wh: number | null;
  wind_wh: number | null;
  telemetry: (Telemetry & { received_at: string; measured_at: string }) | null;
  gps: { latitude: number; longitude: number; measured_at: string } | null;
};
export type Profile = {
  id: string;
  name: string;
  email: string;
  role: string;
  org_id: string;
  organization_name?:string;
  notifications: number;
};
