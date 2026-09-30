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

export async function startNotificationWorker(): Promise<void> {
  try {
    await consumeTasks<NotificationTask>(QUEUES.NOTIFICATIONS, async (task) => {
      const now = new Date().toLocaleTimeString();
      if (task.type === 'EMAIL_OTP') {
        console.log(`\n================== [RABBITMQ NOTIFICATION WORKER 🐰] ==================`);
        console.log(`[${now}] 📨 Gửi mã OTP xác thực:`);
        console.log(`  - Người nhận: ${task.email}`);
        console.log(`  - Mã OTP 6 số: >>> [ ${task.code} ] <<<`);
        console.log(`  - Mục đích: ${task.purpose}`);
        console.log(`  - Thời hạn: ${task.expiresAt}`);
        console.log(`=======================================================================\n`);

        // Hook for real SMTP / Resend / SendGrid delivery when credentials exist
        if (process.env.SMTP_HOST && process.env.SMTP_USER) {
          // Send via SMTP
        }
      } else if (task.type === 'WELCOME_EMAIL') {
        console.log(`[RabbitMQ Worker 🐰] 📬 Gửi email chào mừng tới ${task.email} (${task.fullName})`);
      }
    });
    console.log('[RabbitMQ Worker 🐰] Notification worker started listening on gotek.notifications queue');
  } catch (err: any) {
    console.warn(`[RabbitMQ Worker 🐰] Notification worker initialization skipped: ${err.message}`);
  }
}
