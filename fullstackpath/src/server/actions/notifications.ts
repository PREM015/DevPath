"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/permissions";
import { markNotificationsRead } from "@/server/services/notifications";

export async function markNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await markNotificationsRead(user.id);
  revalidatePath("/dashboard");
}