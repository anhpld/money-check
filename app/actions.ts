"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  AvatarValidationError,
  deleteStoredAvatar,
  getAvatarUpload,
  saveUploadedAvatar,
} from "@/lib/avatar-storage";
import { getPrisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-session";

export type UserActionResult = {
  status: "success" | "error";
  message: string;
};

function getValidName(formData: FormData): UserActionResult | string {
  const value = formData.get("name");
  const name = typeof value === "string" ? value.trim() : "";

  if (name.length < 2) {
    return { status: "error", message: "Tên người dùng cần có ít nhất 2 ký tự." };
  }

  if (name.length > 80) {
    return { status: "error", message: "Tên người dùng không được vượt quá 80 ký tự." };
  }

  return name;
}

export async function createUser(formData: FormData): Promise<UserActionResult> {
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  const name = getValidName(formData);
  if (typeof name !== "string") return name;
  const avatar = getAvatarUpload(formData);
  const id = randomUUID();
  let avatarKey: string | null = null;

  try {
    if (avatar) avatarKey = await saveUploadedAvatar(avatar, id);
    await getPrisma().user.create({ data: { id, name, avatarKey } });
    revalidatePath("/admin");
    revalidatePath("/client");
    return { status: "success", message: `Đã thêm ${name}.` };
  } catch (error) {
    await deleteStoredAvatar(avatarKey).catch(() => {});
    console.error("Không thể tạo người dùng:", error);
    if (error instanceof AvatarValidationError) return { status: "error", message: error.message };
    return { status: "error", message: "Không thể thêm người dùng. Vui lòng thử lại." };
  }
}

export async function updateUser(formData: FormData): Promise<UserActionResult> {
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  const idValue = formData.get("id");
  const id = typeof idValue === "string" ? idValue : "";
  const name = getValidName(formData);

  if (!id) return { status: "error", message: "Không tìm thấy người dùng cần sửa." };
  if (typeof name !== "string") return name;
  const avatar = getAvatarUpload(formData);
  const removeAvatar = formData.get("removeAvatar") === "true";
  let uploadedAvatarKey: string | null = null;

  try {
    const prisma = getPrisma();
    const existingUser = await prisma.user.findUnique({ where: { id }, select: { avatarKey: true } });
    if (!existingUser) return { status: "error", message: "Không tìm thấy người dùng cần sửa." };

    const nextAvatarKey = removeAvatar
      ? null
      : avatar ? (uploadedAvatarKey = await saveUploadedAvatar(avatar, id)) : undefined;
    await prisma.user.update({
      where: { id },
      data: { name, ...(nextAvatarKey !== undefined ? { avatarKey: nextAvatarKey } : {}) },
    });

    if (nextAvatarKey !== undefined && existingUser.avatarKey !== nextAvatarKey) {
      await deleteStoredAvatar(existingUser.avatarKey).catch((error) => {
        console.error("Không thể xóa ảnh đại diện cũ:", error);
      });
    }
    revalidatePath("/admin");
    revalidatePath("/client");
    revalidatePath(`/client/${id}`);
    return { status: "success", message: `Đã cập nhật ${name}.` };
  } catch (error) {
    await deleteStoredAvatar(uploadedAvatarKey).catch(() => {});
    console.error("Không thể cập nhật người dùng:", error);
    if (error instanceof AvatarValidationError) return { status: "error", message: error.message };
    return { status: "error", message: "Không thể cập nhật người dùng. Vui lòng thử lại." };
  }
}

export async function deleteUser(id: string): Promise<UserActionResult> {
  if (!(await isAdminAuthenticated())) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  if (!id) return { status: "error", message: "Không tìm thấy người dùng cần xóa." };

  try {
    const user = await getPrisma().user.delete({ where: { id } });
    await deleteStoredAvatar(user.avatarKey).catch((error) => {
      console.error("Không thể xóa ảnh đại diện của người dùng:", error);
    });
    revalidatePath("/admin");
    revalidatePath("/client");
    return { status: "success", message: `Đã xóa ${user.name}.` };
  } catch (error) {
    console.error("Không thể xóa người dùng:", error);
    return { status: "error", message: "Không thể xóa người dùng. Vui lòng thử lại." };
  }
}
