import { redirect } from "next/navigation";
import { getAuthIdentity } from "@/lib/auth-identity";

export default async function HomePage() {
  const identity = await getAuthIdentity().catch(() => null);
  redirect(identity ? "/app" : "/login");
}
