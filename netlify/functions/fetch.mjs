// Proxy tải trang giveaway: trình duyệt gọi /api/fetch?url=... -> hàm này tải trang -> trả HTML về.
// Làm vậy để trang web trên netlify.app không bị chặn CORS.
//
// An toàn: chỉ cho phép https, chỉ các tên miền trong ALLOWED_SUFFIXES (mặc định ".club"),
// chặn IP/localhost, tối đa 3 lần chuyển hướng (mỗi lần đều kiểm tra lại), giới hạn dung lượng và thời gian.
// Đổi danh sách tên miền: Netlify > Site configuration > Environment variables > ALLOWED_SUFFIXES
// vd: ".club,.com"  (đặt "*" để cho mọi tên miền - không khuyến khích vì ai cũng dùng được proxy của bạn)

const ALLOWED = (process.env.ALLOWED_SUFFIXES || ".club")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 3;

const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function hostAllowed(host) {
  if (ALLOWED.includes("*")) return true;
  return ALLOWED.some((s) => {
    const suffix = s.startsWith(".") ? s : "." + s;
    return host === suffix.slice(1) || host.endsWith(suffix);
  });
}

// Chặn localhost / IP trực tiếp (IPv4, IPv6) / tên nội bộ
function hostBlocked(host) {
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.includes(":")) return true; // IPv6
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true; // IPv4
  return false;
}

function check(u) {
  if (u.protocol !== "https:") return "Chỉ hỗ trợ link https";
  const host = u.hostname.toLowerCase();
  if (hostBlocked(host)) return "Địa chỉ không được phép";
  if (!hostAllowed(host)) return `Tên miền ${host} không nằm trong danh sách cho phép (ALLOWED_SUFFIXES)`;
  return null;
}

export default async (req) => {
  const target = new URL(req.url).searchParams.get("url");
  if (!target) return json(400, { error: "Thiếu tham số url" });

  let u;
  try {
    u = new URL(target);
  } catch {
    return json(400, { error: "Link không hợp lệ" });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    let res;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const problem = check(u);
      if (problem) return json(403, { error: problem });

      res = await fetch(u, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-US,en;q=0.9",
        },
      });

      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        if (hop === MAX_REDIRECTS) return json(502, { error: "Quá nhiều lần chuyển hướng" });
        u = new URL(res.headers.get("location"), u);
        continue;
      }
      break;
    }

    if (!res.ok) return json(502, { error: `Trang trả về mã ${res.status}` });

    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) return json(413, { error: "Trang quá lớn" });

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return json(413, { error: "Trang quá lớn" });

    return new Response(buf, {
      status: 200,
      headers: {
        "content-type": res.headers.get("content-type") || "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    const msg = err && err.name === "AbortError" ? "Hết thời gian chờ" : "Không tải được trang";
    return json(502, { error: msg });
  } finally {
    clearTimeout(timer);
  }
};

export const config = { path: "/api/fetch" };
