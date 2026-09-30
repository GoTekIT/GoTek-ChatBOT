import {BrevoClient} from '@getbrevo/brevo';
import {consumeTasks, QUEUES} from '../core/rabbitmq.js';

export interface OtpNotificationTask {
  type: 'EMAIL_OTP';
  email: string;
  code: string;
  purpose: 'reset' | 'login' | 'verify';
  expiresAt: string;
}

export interface WelcomeNotificationTask {
  type: 'WELCOME_EMAIL';
  email: string;
  fullName: string;
}

export type NotificationTask = OtpNotificationTask | WelcomeNotificationTask;

// ---- Brevo client (singleton) -------------------------------------------------
let _brevo: BrevoClient | null = null;

function getBrevo(): BrevoClient | null {
  const key = process.env.BREVO_API_KEY;
  if (!key) return null;
  if (!_brevo) _brevo = new BrevoClient({apiKey: key});
  return _brevo;
}

// ---- Helpers ------------------------------------------------------------------
function purposeLabel(purpose: OtpNotificationTask['purpose']): string {
  switch (purpose) {
    case 'reset':  return 'đặt lại mật khẩu';
    case 'login':  return 'đăng nhập';
    case 'verify': return 'xác thực tài khoản';
  }
}

function buildOtpHtml(task: OtpNotificationTask): {html: string; text: string} {
  const label  = purposeLabel(task.purpose);
  const expiry = new Date(task.expiresAt).toLocaleTimeString('vi-VN');

  const html = `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px;text-align:center">
    <h1 style="color:#fff;margin:8px 0 4px;font-size:22px">GoTek Chatbot</h1>
    <p style="color:#c7d2fe;margin:0;font-size:14px">Nền tảng CSKH Đa Kênh Thông Minh</p>
  </div>
  <div style="padding:36px 32px">
    <h2 style="color:#111827;font-size:18px;margin:0 0 12px">Mã xác thực của bạn</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
      Bạn đã yêu cầu mã OTP để <strong>${label}</strong>. Vui lòng sử dụng mã bên dưới:
    </p>
    <div style="background:#eff6ff;border:2px dashed #3b82f6;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px">
      <span style="font-size:42px;font-weight:900;letter-spacing:12px;color:#1d4ed8;font-family:monospace">${task.code}</span>
    </div>
    <p style="color:#9ca3af;font-size:13px;margin:0 0 8px">⏰ Mã này hết hạn lúc <strong>${expiry}</strong>.</p>
    <p style="color:#9ca3af;font-size:13px;margin:0">🔒 Không chia sẻ mã này với bất kỳ ai. GoTek sẽ không bao giờ hỏi mã OTP của bạn.</p>
  </div>
  <div style="background:#f3f4f6;padding:16px 32px;text-align:center">
    <p style="color:#d1d5db;font-size:12px;margin:0">© 2026 GoTek Technology. Tất cả quyền được bảo lưu.</p>
  </div>
</div>`.trim();

  const text = `Mã OTP GoTek: ${task.code}\nMục đích: ${label}\nHết hạn lúc: ${expiry}\nKhông chia sẻ mã này với bất kỳ ai.`;
  return {html, text};
}

// ---- Senders ------------------------------------------------------------------
async function sendOtpEmail(task: OtpNotificationTask): Promise<void> {
  const senderEmail = process.env.EMAIL_FROM      ?? 'no-reply@gotek.vn';
  const senderName  = process.env.EMAIL_FROM_NAME ?? 'GoTek Chatbot';
  const label       = purposeLabel(task.purpose);
  const {html, text} = buildOtpHtml(task);
  const subject     = `[GoTek] Mã OTP ${task.code} — ${label.charAt(0).toUpperCase() + label.slice(1)}`;

  // 1) Brevo API
  const brevo = getBrevo();
  if (brevo) {
    try {
      await brevo.transactionalEmails.sendTransacEmail({
        sender:      {name: senderName, email: senderEmail},
        to:          [{email: task.email}],
        subject,
        htmlContent: html,
        textContent: text,
      });
      console.log(`[Worker 🐰] ✅ OTP email gửi qua Brevo → ${task.email} (${task.purpose})`);
      return;
    } catch (brevoErr: any) {
      const hint = brevoErr?.body?.message || brevoErr?.message || String(brevoErr);
      console.warn(`[Worker 🐰] ⚠️  Brevo failed (${brevoErr?.statusCode ?? '?'}): ${hint.substring(0, 120)}`);
      console.warn(`[Worker 🐰] → Falling back to SMTP...`);
    }
  }

  // 2) Nodemailer SMTP fallback
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const nodemailer = await import('nodemailer');
    const transport  = nodemailer.default.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth:   {user: process.env.SMTP_USER, pass: process.env.SMTP_PASS},
    });
    await transport.sendMail({
      from:    `"${senderName}" <${process.env.SMTP_USER}>`,
      to:      task.email,
      subject,
      html,
      text,
    });
    console.log(`[Worker 🐰] ✅ OTP email gửi qua SMTP → ${task.email}`);
    return;
  }

  // 3) Dev fallback — print to console
  console.log(`\n══════════════ [DEV MODE — OTP EMAIL] ══════════════`);
  console.log(`  Tới:     ${task.email}`);
  console.log(`  Mã OTP:  >>> [ ${task.code} ] <<<`);
  console.log(`  Mục đích: ${task.purpose}`);
  console.log(`  Hết hạn: ${task.expiresAt}`);
  console.log(`════════════════════════════════════════════════════\n`);
}

async function sendWelcomeEmail(task: WelcomeNotificationTask): Promise<void> {
  const senderEmail = process.env.EMAIL_FROM      ?? 'no-reply@gotek.vn';
  const senderName  = process.env.EMAIL_FROM_NAME ?? 'GoTek Chatbot';

  const html = `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f9fafb;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px;text-align:center">
    <h1 style="color:#fff;margin:0 0 8px;font-size:24px">Chào mừng ${task.fullName}! 🎉</h1>
    <p style="color:#c7d2fe;margin:0">Tài khoản GoTek Chatbot của bạn đã sẵn sàng</p>
  </div>
  <div style="padding:36px 32px">
    <p style="color:#374151;font-size:15px;line-height:1.6">
      Cảm ơn bạn đã đăng ký <strong>GoTek Chatbot</strong> — nền tảng CSKH đa kênh thông minh.
      Bắt đầu tạo workspace và kết nối với khách hàng của bạn ngay hôm nay!
    </p>
  </div>
  <div style="background:#f3f4f6;padding:16px 32px;text-align:center">
    <p style="color:#d1d5db;font-size:12px;margin:0">© 2026 GoTek Technology. Tất cả quyền được bảo lưu.</p>
  </div>
</div>`.trim();

  const brevo = getBrevo();
  if (brevo) {
    await brevo.transactionalEmails.sendTransacEmail({
      sender:      {name: senderName, email: senderEmail},
      to:          [{email: task.email, name: task.fullName}],
      subject:     `Chào mừng ${task.fullName} đến với GoTek! 🎉`,
      htmlContent: html,
    });
    console.log(`[Worker 🐰] ✅ Welcome email gửi qua Brevo → ${task.email}`);
    return;
  }

  console.log(`[Worker 🐰] 📬 Welcome email (dev): ${task.email} (${task.fullName})`);
}

// ---- Worker entry point -------------------------------------------------------
export async function startNotificationWorker(): Promise<void> {
  try {
    await consumeTasks<NotificationTask>(QUEUES.NOTIFICATIONS, async (task) => {
      if (task.type === 'EMAIL_OTP') {
        await sendOtpEmail(task);
      } else if (task.type === 'WELCOME_EMAIL') {
        await sendWelcomeEmail(task);
      }
    });
    const brevoActive = !!process.env.BREVO_API_KEY;
    const smtpActive  = !!(process.env.SMTP_HOST && process.env.SMTP_USER);
    const mode = brevoActive ? 'Brevo API' : smtpActive ? 'SMTP' : 'DEV (console only)';
    console.log(`[Worker 🐰] Notification worker started ✅ — delivery mode: ${mode}`);
  } catch (err: any) {
    console.warn(`[Worker 🐰] Notification worker init skipped: ${err.message}`);
  }
}
