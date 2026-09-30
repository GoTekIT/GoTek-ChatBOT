const messages: Record<string, string> = {
  TAKEOVER_REQUIRED: 'Bạn cần tiếp nhận hội thoại trước khi gửi trả lời khách.',
  STALE_REPLY_OWNER: 'Người phụ trách hội thoại đã thay đổi. Tải lại trước khi tiếp tục.',
  VERSION_CONFLICT: 'Quy tắc đã được thay đổi ở phiên khác. Tải lại danh sách trước khi thử lại.',
  RESPONSE_TOO_LARGE: 'Nguồn vượt quá giới hạn dung lượng.',
  REDIRECT_LIMIT: 'Nguồn chuyển hướng quá số lần cho phép.',
  REDIRECT_ORIGIN_BLOCKED: 'Nguồn chuyển hướng khác origin đã cho phép.',
  SOURCE_PAUSED: 'Nguồn đang tạm dừng. Bật lại trước khi xem thử.',
  SOURCE_CONTENT_EMPTY: 'Không tìm thấy nội dung đọc được trong nguồn.',
  SOURCE_XML_INVALID: 'Nguồn XML không hợp lệ.',
  SOURCE_CONTENT_UNSUPPORTED: 'Kiểu nội dung của nguồn chưa được hỗ trợ.',
  SSRF_BLOCKED: 'Địa chỉ nguồn không được phép truy cập.',
  SOURCE_DNS_FAILED: 'Không thể phân giải tên miền nguồn.',
  SOURCE_TIMEOUT: 'Nguồn phản hồi quá thời gian cho phép.',
  SOURCE_FETCH_FAILED: 'Không thể tải nguồn.',
  SOURCE_HTTP_ERROR: 'Nguồn trả về lỗi HTTP.',
  SOURCE_ENCODING_UNSUPPORTED: 'Nguồn dùng kiểu nén chưa hỗ trợ.',
  SOURCE_REDIRECT_INVALID: 'Nguồn có redirect không hợp lệ.',
  SUPPORT_GRANT_UNAVAILABLE: 'Quyền hỗ trợ không tồn tại, không dành cho bạn, đã thu hồi hoặc hết hạn.',
  SUPPORT_SUBJECT_UNAVAILABLE: 'Người hỗ trợ chưa có quyền nền tảng khả dụng.',
  PLATFORM_FORBIDDEN: 'Bạn không có quyền Platform Admin.',
  PROVIDER_SECRET_MISSING: 'Chưa có khóa provider trên server. Hãy cấu hình khóa trước khi bật.',
  CAPABILITY_UNAVAILABLE: 'Model không hỗ trợ khả năng được yêu cầu.',
  MODEL_NOT_GRANTED: 'Model chưa được cấp quyền hoặc đang bị tắt.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn hoặc chưa đăng nhập.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  WORKSPACE_DISABLED: 'Workspace đã tạm dừng.',
  INVALID_OR_EXPIRED_TOKEN: 'Liên kết hoặc mã xác thực không hợp lệ, đã dùng hoặc hết hạn.',
  RESEND_COOLDOWN: 'Vui lòng chờ 60 giây trước khi gửi lại.',
  RATE_LIMITED: 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.',
  LAST_OWNER: 'Workspace phải còn ít nhất một Owner.',
  SEAT_LIMIT: 'Đã đạt giới hạn thành viên.',
  ALREADY_MEMBER: 'Người này đã là thành viên.',
  CONFLICT: 'Dữ liệu đã tồn tại hoặc vừa thay đổi.',
  NO_MEMBERSHIP: 'Tài khoản chưa có workspace khả dụng.',
  VALIDATION: 'Vui lòng kiểm tra các trường bên dưới.',
  INTERNAL: 'Chưa thể xử lý. Vui lòng thử lại.',
  INCORRECT_CURRENT_PASSWORD: 'Mật khẩu hiện tại không chính xác.',
  USER_NOT_FOUND: 'Không tìm thấy thông tin tài khoản người dùng.'
};

export class ApiError extends Error {
  constructor(public code: string, public fields: Record<string, string[]> = {}) {
    super(messages[code] || code);
  }
}

const TOKEN_KEY = 'gotek_session_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore storage errors
  }
}

export function removeStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
}

export async function api(path: string, method = 'GET', body?: unknown) {
  let res: Response;
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Gotek-Request': '1'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new Error('Không thể kết nối. Kiểm tra mạng và thử lại.');
  }

  const contentType = res.headers.get('content-type') || '';
  let data: any;
  try {
    data = contentType.includes('application/json') ? await res.json() : {error: 'INTERNAL'};
  } catch {
    data = {error: 'INTERNAL'};
  }

  if (!res.ok) {
    throw new ApiError(data.error || 'INTERNAL', data.fields);
  }

  return data;
}
