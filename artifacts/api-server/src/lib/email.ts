import nodemailer from "nodemailer";
import { logger } from "./logger";

const ADMIN_EMAIL = "ashishnairoo048@gmail.com";

function createTransporter() {
  const appPassword = process.env.GMAIL_APP_PASSWORD;
  if (!appPassword) {
    logger.warn("GMAIL_APP_PASSWORD not set — email notifications disabled");
    return null;
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: ADMIN_EMAIL,
      pass: appPassword,
    },
  });
}

export async function sendNewUserNotification(user: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  isNewUser: boolean;
}): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) return;

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unknown";
  const action = user.isNewUser ? "just created an account" : "just signed in";

  const html = `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; border: 1px solid #dce3ef; border-radius: 8px; overflow: hidden;">
      <div style="background: hsl(215,50%,23%); padding: 20px 28px;">
        <h2 style="color: #fff; margin: 0; font-size: 18px;">Cambridge AI Tutor — ${user.isNewUser ? "New User" : "Sign-In"} Alert</h2>
      </div>
      <div style="padding: 24px 28px; background: #fff;">
        <p style="margin: 0 0 12px; color: #444;">A student <strong>${action}</strong>:</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #888; width: 120px;">Name</td>
            <td style="padding: 8px 0; color: #222; font-weight: 600;">${displayName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888;">Email</td>
            <td style="padding: 8px 0; color: #222;">${user.email ?? "—"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888;">User ID</td>
            <td style="padding: 8px 0; color: #aaa; font-size: 12px;">${user.id}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888;">Time</td>
            <td style="padding: 8px 0; color: #222;">${new Date().toUTCString()}</td>
          </tr>
        </table>
        <p style="margin: 20px 0 0; color: #999; font-size: 12px;">Password is never stored or shared — only name and email are reported.</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Cambridge AI Tutor" <${ADMIN_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: `${user.isNewUser ? "🎓 New student" : "📚 Student sign-in"}: ${displayName}`,
      html,
    });
    logger.info({ userId: user.id }, "Admin notification email sent");
  } catch (err) {
    logger.error({ err }, "Failed to send admin notification email");
  }
}
