import { Resend } from 'resend';

const resend = new Resend(process.env['RESEND_API_KEY']);
const FROM = process.env['EMAIL_FROM'] ?? 'RALD ALIA <noreply@raldalia.com>';

export class NotificationService {
  async sendEmail(to: string, subject: string, html: string, text?: string) {
    try {
      const { error } = await resend.emails.send({ from: FROM, to, subject, html, text });
      if (error) {
        console.error(`[notification-service] Resend error to ${to}:`, error);
      } else {
        console.log(`[notification-service] Email sent to ${to}`);
      }
    } catch (err) {
      console.error(`[notification-service] Email failed to ${to}:`, err);
    }
  }

  async sendVerificationEmail(to: string, firstName: string, otp: string) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Verify your RALD ALIA account</title></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'Inter',sans-serif;color:#FAFAFA">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#131313;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden">
    <tr><td style="padding:32px 32px 0">
      <div style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.24em;color:#666;margin-bottom:8px">RALD ALIA</div>
      <div style="font-size:22px;font-weight:600;color:#FAFAFA">Verify your email address</div>
    </td></tr>
    <tr><td style="padding:24px 32px">
      <p style="color:#999;font-size:15px;margin:0 0 24px">Hi ${firstName}, thanks for joining RALD ALIA. Use the code below to verify your email address.</p>
      <div style="background:#0A0A0A;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:24px;text-align:center;margin:0 0 24px">
        <div style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;letter-spacing:0.3em;color:#D90429">${otp}</div>
        <div style="font-size:12px;color:#666;margin-top:8px">Expires in 10 minutes</div>
      </div>
      <p style="color:#666;font-size:13px;margin:0">If you didn't create an account, you can safely ignore this email.</p>
    </td></tr>
    <tr><td style="padding:16px 32px 32px;border-top:1px solid rgba(255,255,255,0.06)">
      <div style="font-size:12px;color:#444">© ${new Date().getFullYear()} RALD ALIA Infrastructure · Lagos · Nairobi · Accra · Cape Town</div>
    </td></tr>
  </table>
</body>
</html>`;
    await this.sendEmail(to, 'Verify your RALD ALIA account', html, `Your verification code: ${otp}. Expires in 10 minutes.`);
  }

  async sendWelcomeEmail(to: string, firstName: string) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Welcome to RALD ALIA</title></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'Inter',sans-serif;color:#FAFAFA">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#131313;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden">
    <tr><td style="padding:32px 32px 0">
      <div style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.24em;color:#666;margin-bottom:8px">RALD ALIA</div>
      <div style="font-size:22px;font-weight:600;color:#FAFAFA">Welcome to RALD ALIA, ${firstName}.</div>
    </td></tr>
    <tr><td style="padding:24px 32px">
      <p style="color:#999;font-size:15px;margin:0 0 16px">Your account is verified. You are now part of the Financial Identity Network for Africa.</p>
      <ul style="color:#999;font-size:15px;padding-left:20px;margin:0 0 24px">
        <li style="margin-bottom:8px">Create and manage ALIA financial identities</li>
        <li style="margin-bottom:8px">Connect bank accounts and configure routing</li>
        <li style="margin-bottom:8px">Access the developer console and API keys</li>
        <li>Use the sandbox to test integrations</li>
      </ul>
      <a href="https://app.raldalia.com" style="display:inline-block;background:#D90429;color:#FAFAFA;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500">Open Console</a>
    </td></tr>
    <tr><td style="padding:16px 32px 32px;border-top:1px solid rgba(255,255,255,0.06)">
      <div style="font-size:12px;color:#444">© ${new Date().getFullYear()} RALD ALIA Infrastructure · Lagos · Nairobi · Accra · Cape Town</div>
    </td></tr>
  </table>
</body>
</html>`;
    await this.sendEmail(to, 'Welcome to RALD ALIA', html, `Welcome to RALD ALIA, ${firstName}! Your account is now verified.`);
  }

  async sendPasswordResetEmail(to: string, firstName: string, otp: string) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Reset your RALD ALIA password</title></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'Inter',sans-serif;color:#FAFAFA">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#131313;border:1px solid rgba(217,4,41,0.3);border-radius:12px;overflow:hidden">
    <tr><td style="padding:32px 32px 0">
      <div style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.24em;color:#D90429;margin-bottom:8px">RALD ALIA · SECURITY</div>
      <div style="font-size:22px;font-weight:600;color:#FAFAFA">Password reset request</div>
    </td></tr>
    <tr><td style="padding:24px 32px">
      <p style="color:#999;font-size:15px;margin:0 0 24px">Hi ${firstName}, use the code below to reset your password.</p>
      <div style="background:#0A0A0A;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:24px;text-align:center;margin:0 0 24px">
        <div style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;letter-spacing:0.3em;color:#D90429">${otp}</div>
        <div style="font-size:12px;color:#666;margin-top:8px">Expires in 15 minutes</div>
      </div>
      <p style="color:#666;font-size:13px;margin:0">If you did not request this, contact <a href="mailto:security@raldalia.com" style="color:#D90429">security@raldalia.com</a> immediately.</p>
    </td></tr>
    <tr><td style="padding:16px 32px 32px;border-top:1px solid rgba(255,255,255,0.06)">
      <div style="font-size:12px;color:#444">© ${new Date().getFullYear()} RALD ALIA Infrastructure</div>
    </td></tr>
  </table>
</body>
</html>`;
    await this.sendEmail(to, '[RALD ALIA] Password reset code', html, `Your password reset code: ${otp}. Expires in 15 minutes.`);
  }

  async sendSecurityAlert(to: string, firstName: string, event: string, detail: string) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Security Alert</title></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'Inter',sans-serif;color:#FAFAFA">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#131313;border:1px solid rgba(217,4,41,0.3);border-radius:12px;overflow:hidden">
    <tr><td style="padding:32px 32px 0">
      <div style="font-family:'Courier New',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.24em;color:#D90429;margin-bottom:8px">RALD ALIA · SECURITY ALERT</div>
      <div style="font-size:22px;font-weight:600;color:#FAFAFA">${event}</div>
    </td></tr>
    <tr><td style="padding:24px 32px">
      <p style="color:#999;font-size:15px;margin:0 0 16px">Hi ${firstName}, a security event was detected on your account.</p>
      <div style="background:#0A0A0A;border-left:3px solid #D90429;padding:16px;border-radius:0 8px 8px 0;margin:0 0 24px">
        <div style="color:#FAFAFA;font-size:14px">${detail}</div>
        <div style="color:#666;font-size:12px;margin-top:8px">${new Date().toISOString()}</div>
      </div>
      <p style="color:#666;font-size:13px;margin:0">If this was not you, contact <a href="mailto:security@raldalia.com" style="color:#D90429">security@raldalia.com</a> immediately.</p>
    </td></tr>
    <tr><td style="padding:16px 32px 32px;border-top:1px solid rgba(255,255,255,0.06)">
      <div style="font-size:12px;color:#444">© ${new Date().getFullYear()} RALD ALIA Infrastructure</div>
    </td></tr>
  </table>
</body>
</html>`;
    await this.sendEmail(to, `[SECURITY ALERT] ${event} — RALD ALIA`, html);
  }

  async sendWebhook(url: string, payload: Record<string, unknown>, secret: string) {
    try {
      const body = JSON.stringify(payload);
      const crypto = await import('crypto');
      const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RaldAlia-Signature': `sha256=${signature}`,
          'X-RaldAlia-Timestamp': Date.now().toString(),
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      console.log(`[notification-service] Webhook delivered to ${url} — ${res.status}`);
    } catch (err) {
      console.error(`[notification-service] Webhook failed to ${url}:`, err);
    }
  }
}
