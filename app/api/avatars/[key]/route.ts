import { readStoredAvatar } from "@/lib/avatar-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  try {
    const avatar = await readStoredAvatar(key);
    return new Response(avatar.data, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(avatar.data.byteLength),
        "Content-Type": avatar.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return Response.json(
      { success: false, error: code === "ENOENT" ? "Không tìm thấy ảnh đại diện." : "Không thể tải ảnh đại diện." },
      { status: code === "ENOENT" ? 404 : 400 },
    );
  }
}
