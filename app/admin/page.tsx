import { requireAdminSession } from "../../lib/admin-auth";
import DashboardClient from "./dashboard-client";

export default async function AdminDashboardPage() {
  await requireAdminSession();
  return <DashboardClient />;
}
