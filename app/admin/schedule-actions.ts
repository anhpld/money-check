"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";

export type UpcomingMatchData = {
  thoi_gian: string;
  san_bong: string;
  doi_thu: string;
  mau_ao?: string;
  ghi_chu: string;
  expiresAt: number;
  updatedAt: string;
  updatedBy: string;
};

export type UpcomingMatchState = {
  hasSchedule: boolean;
  isExpired?: boolean;
  data: UpcomingMatchData | null;
};

export async function getNextFriday22hTimestamp(mockDateStr?: string): Promise<number> {
  const now = mockDateStr ? new Date(mockDateStr) : new Date();
  const vnTimeMs = now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60 * 1000;
  const vnDate = new Date(vnTimeMs);
  const dayOfWeek = vnDate.getDay();
  const hour = vnDate.getHours();

  let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  if (daysUntilFriday === 0 && hour >= 22) {
    daysUntilFriday = 7;
  }

  const targetVn = new Date(vnDate);
  targetVn.setDate(targetVn.getDate() + daysUntilFriday);
  targetVn.setHours(22, 0, 0, 0);

  const targetUtcMs = targetVn.getTime() - (7 * 60 + now.getTimezoneOffset()) * 60 * 1000;
  return targetUtcMs;
}

export async function getUpcomingMatchSchedule(): Promise<UpcomingMatchState> {
  try {
    const prisma = getPrisma();
    const setting = await prisma.setting.findUnique({
      where: {
        type_key: {
          type: "team-schedule",
          key: "upcoming-match",
        },
      },
    });

    if (!setting || !setting.enabled) {
      return { hasSchedule: false, data: null };
    }

    const data: UpcomingMatchData = JSON.parse(setting.value);
    const now = Date.now();

    if (data.expiresAt && now > data.expiresAt) {
      await prisma.setting.update({
        where: {
          type_key: {
            type: "team-schedule",
            key: "upcoming-match",
          },
        },
        data: { enabled: false },
      });
      return { hasSchedule: false, isExpired: true, data: null };
    }

    return { hasSchedule: true, data };
  } catch (error) {
    console.error("Lỗi đọc lịch thi đấu:", error);
    return { hasSchedule: false, data: null };
  }
}

export async function updateUpcomingMatchSchedule(formData: FormData) {
  const thoi_gian = (formData.get("thoi_gian") as string)?.trim();
  const san_bong = (formData.get("san_bong") as string)?.trim();
  const doi_thu = (formData.get("doi_thu") as string)?.trim() || "Đang chờ chốt đối thủ";
  const ghi_chu = (formData.get("ghi_chu") as string)?.trim() || "";

  if (!thoi_gian || !san_bong) {
    return { success: false, error: "Vui lòng nhập thời gian và sân bóng!" };
  }

  try {
    const prisma = getPrisma();
    const expiresAt = await getNextFriday22hTimestamp();

    const scheduleData: UpcomingMatchData = {
      thoi_gian,
      san_bong,
      doi_thu,
      ghi_chu,
      expiresAt,
      updatedAt: new Date().toISOString(),
      updatedBy: "Đức Anh (Admin Web)",
    };

    await prisma.setting.upsert({
      where: {
        type_key: {
          type: "team-schedule",
          key: "upcoming-match",
        },
      },
      create: {
        type: "team-schedule",
        key: "upcoming-match",
        value: JSON.stringify(scheduleData),
        enabled: true,
      },
      update: {
        value: JSON.stringify(scheduleData),
        enabled: true,
      },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || "Không thể lưu lịch thi đấu." };
  }
}

export async function cancelUpcomingMatchSchedule() {
  try {
    const prisma = getPrisma();
    await prisma.setting.update({
      where: {
        type_key: {
          type: "team-schedule",
          key: "upcoming-match",
        },
      },
      data: { enabled: false },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || "Không thể hủy lịch thi đấu." };
  }
}
