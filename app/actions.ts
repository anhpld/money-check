"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";

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
  const name = getValidName(formData);
  if (typeof name !== "string") return name;

  try {
    await getPrisma().user.create({ data: { name } });
    revalidatePath("/");
    return { status: "success", message: `Đã thêm ${name}.` };
  } catch (error) {
    console.error("Không thể tạo người dùng:", error);
    return { status: "error", message: "Không thể thêm người dùng. Vui lòng thử lại." };
  }
}

export async function updateUser(formData: FormData): Promise<UserActionResult> {
  const idValue = formData.get("id");
  const id = typeof idValue === "string" ? idValue : "";
  const name = getValidName(formData);

  if (!id) return { status: "error", message: "Không tìm thấy người dùng cần sửa." };
  if (typeof name !== "string") return name;

  try {
    await getPrisma().user.update({ where: { id }, data: { name } });
    revalidatePath("/");
    return { status: "success", message: `Đã cập nhật ${name}.` };
  } catch (error) {
    console.error("Không thể cập nhật người dùng:", error);
    return { status: "error", message: "Không thể cập nhật người dùng. Vui lòng thử lại." };
  }
}

export async function deleteUser(id: string): Promise<UserActionResult> {
  if (!id) return { status: "error", message: "Không tìm thấy người dùng cần xóa." };

  try {
    const user = await getPrisma().user.delete({ where: { id } });
    revalidatePath("/");
    return { status: "success", message: `Đã xóa ${user.name}.` };
  } catch (error) {
    console.error("Không thể xóa người dùng:", error);
    return { status: "error", message: "Không thể xóa người dùng. Vui lòng thử lại." };
  }
}
