/**
 * emailService.ts
 * Centralized service for sending emails via Resend REST API (Client-side).
 * This bypasses Cloud Functions for Spark plan projects.
 */

const RESEND_API_KEY = process.env.NEXT_PUBLIC_RESEND_API_KEY;
const FROM_EMAIL = 'ABM Workshop <onboarding@resend.dev>';
const API_URL = 'https://api.resend.com/emails';

const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .logo { font-size: 24px; font-weight: 800; color: #111; letter-spacing: -0.5px; margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; color: #111; margin: 0 0 8px; }
    p { font-size: 15px; line-height: 1.6; color: #555; margin: 0 0 16px; }
    .code-box { background: #f8f8f8; border: 2px dashed #ddd; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }
    .code { font-size: 32px; font-weight: 800; letter-spacing: 4px; color: #111; font-family: monospace; }
    .badge { display: inline-block; background: #111; color: #fff; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; text-transform: capitalize; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">ABM</div>
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ABM Workshop & Marketplace. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

const staffInviteTemplate = (name: string, role: string, invitationCode: string, workshopName?: string) => emailWrapper(`
  <h1>You're Invited! 🎉</h1>
  <p>Hi ${name || 'there'},</p>
  <p>You've been invited to join <strong>${workshopName || 'a workshop'}</strong> as a <span class="badge">${role.replace('_', ' ')}</span>.</p>
  <p>Use this invitation code to set up your account in the ABM app:</p>
  <div class="code-box">
    <div class="code">${invitationCode}</div>
  </div>
  <p>Open the ABM app, go to <strong>Staff Invite</strong>, and enter this code to get started.</p>
  <p style="color: #999; font-size: 13px;">This code is unique to you. Do not share it with anyone else.</p>
`);

const welcomeTemplate = (name: string, role?: string) => emailWrapper(`
  <h1>Welcome to ABM! 👋</h1>
  <p>Hi ${name || 'there'},</p>
  <p>Your account has been successfully created as a <span class="badge">${(role || 'member').replace('_', ' ')}</span>.</p>
  <p>You can now access the ABM Workshop & Marketplace platform. Here's what you can do:</p>
  <ul style="color: #555; font-size: 15px; line-height: 2;">
    <li>Access workshop services and manage your jobs</li>
    <li>Browse the marketplace for auto parts</li>
    <li>Track orders and service history</li>
  </ul>
  <p>If you have any questions, reach out to us at <a href="mailto:support@abmtek.com" style="color: #111; font-weight: 600;">support@abmtek.com</a>.</p>
`);

const passwordResetTemplate = (name: string, resetLink: string) => emailWrapper(`
  <h1>Reset Your Password 🔑</h1>
  <p>Hi ${name || 'there'},</p>
  <p>We received a request to reset your password. Click the button below to create a new one:</p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="${resetLink}" style="display: inline-block; background: #111; color: #fff; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none;">Reset Password</a>
  </div>
  <p style="color: #999; font-size: 13px;">If you didn't request this, you can safely ignore this email. This link will expire in 1 hour.</p>
`);

const invoiceTemplate = (invoice: any) => {
    const items = (invoice.items || []).map((item: any) => `
        <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333">${item.description || '—'}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:center;font-size:14px;color:#555">${item.quantity || 1}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;color:#555">₦${(item.unitPrice || 0).toLocaleString()}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;font-weight:600;color:#111">₦${(item.total || 0).toLocaleString()}</td>
        </tr>
    `).join('');

    return emailWrapper(`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">
            <div>
                <h1 style="font-size:28px;font-weight:900;letter-spacing:-1px;color:#111;margin:0">INVOICE</h1>
                <p style="font-size:13px;color:#999;margin:4px 0 0;font-family:monospace">#${invoice.zohoInvoiceNumber || invoice.id || ''}</p>
            </div>
            <div style="text-align:right">
                <p style="font-size:13px;color:#555;margin:0">Date: <strong>${invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}) : '—'}</strong></p>
                <p style="font-size:13px;color:#555;margin:4px 0 0">Status: <span style="background:${invoice.paymentStatus === 'paid' ? '#dcfce7' : '#fef3c7'};color:${invoice.paymentStatus === 'paid' ? '#16a34a' : '#92400e'};padding:2px 8px;border-radius:4px;font-weight:700;font-size:12px;text-transform:uppercase">${invoice.paymentStatus || 'pending'}</span></p>
            </div>
        </div>

        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:24px">
            <p style="margin:0;font-size:13px;color:#999;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Bill To</p>
            <p style="margin:6px 0 0;font-size:16px;font-weight:700;color:#111">${invoice.customerName || '—'}</p>
            ${invoice.carBrand ? `<p style="margin:2px 0 0;font-size:13px;color:#666">Vehicle: ${invoice.carBrand}</p>` : ''}
            ${invoice.customerPhone ? `<p style="margin:2px 0 0;font-size:13px;color:#666">${invoice.customerPhone}</p>` : ''}
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
            <thead>
                <tr style="border-bottom:2px solid #111">
                    <th style="text-align:left;padding:8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#999">Description</th>
                    <th style="text-align:center;padding:8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#999">Qty</th>
                    <th style="text-align:right;padding:8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#999">Unit Price</th>
                    <th style="text-align:right;padding:8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#999">Total</th>
                </tr>
            </thead>
            <tbody>${items || '<tr><td colspan="4" style="padding:16px 0;color:#999;font-size:13px">No line items</td></tr>'}</tbody>
        </table>

        <div style="border-top:2px solid #111;padding-top:16px">
            ${invoice.discount ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:14px;color:#666">Discount</span><span style="font-size:14px;color:#666">-₦${(invoice.discount||0).toLocaleString()}</span></div>` : ''}
            ${invoice.vat ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:14px;color:#666">VAT (${invoice.vatRate||7.5}%)</span><span style="font-size:14px;color:#666">₦${(invoice.vat||0).toLocaleString()}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid #eee">
                <span style="font-size:18px;font-weight:800;color:#111">TOTAL</span>
                <span style="font-size:18px;font-weight:800;color:#111">₦${(invoice.total||0).toLocaleString()}</span>
            </div>
            ${(invoice.amountPaid || 0) > 0 ? `
            <div style="display:flex;justify-content:space-between;margin-top:8px">
                <span style="font-size:14px;color:#16a34a;font-weight:600">Amount Paid</span>
                <span style="font-size:14px;color:#16a34a;font-weight:600">₦${(invoice.amountPaid||0).toLocaleString()}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px">
                <span style="font-size:14px;color:#dc2626;font-weight:600">Balance Due</span>
                <span style="font-size:14px;color:#dc2626;font-weight:600">₦${((invoice.total||0)-(invoice.amountPaid||0)).toLocaleString()}</span>
            </div>` : ''}
        </div>

        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-top:24px;text-align:center">
            <p style="margin:0;font-size:13px;color:#555">Thank you for your business! For any questions, contact <strong>ABM-TEK Workshop</strong>.</p>
            <p style="margin:4px 0 0;font-size:13px;color:#999">📞 Contact us for any queries regarding this invoice</p>
        </div>
    `);
};

export const emailService = {
    async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
        if (!RESEND_API_KEY) {
            console.warn('Resend API key missing. Email not sent.');
            return false;
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                    from: FROM_EMAIL,
                    to: [to],
                    subject,
                    html,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to send email');
            }

            return true;
        } catch (error) {
            console.error('Email sending failed:', error);
            return false;
        }
    },

    async sendStaffInvite(to: string, name: string, code: string, role: string, workshopName?: string) {
        return this.sendEmail(
            to,
            `You're invited to join ${workshopName || 'ABM Workshop'}!`,
            staffInviteTemplate(name, role, code, workshopName)
        );
    },

    async sendWelcomeEmail(to: string, name: string, role?: string) {
        return this.sendEmail(
            to,
            'Welcome to ABM Workshop & Marketplace!',
            welcomeTemplate(name, role)
        );
    },

    async sendPasswordResetEmail(to: string, name: string, resetLink: string) {
        return this.sendEmail(
            to,
            'Reset Your ABM Password',
            passwordResetTemplate(name, resetLink)
        );
    },

    async sendInvoiceEmail(to: string, invoice: any) {
        const invoiceNum = invoice.zohoInvoiceNumber || invoice.id?.slice(0, 12) || 'Invoice';
        return this.sendEmail(
            to,
            `Invoice ${invoiceNum} from ABM-TEK Workshop — ₦${(invoice.total || 0).toLocaleString()}`,
            invoiceTemplate(invoice)
        );
    }
};
