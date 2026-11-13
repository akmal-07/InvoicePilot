import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { formatUSD } from '../src/utils/invoiceMath';

const ReminderRequestSchema = z.object({
  invoice_id: z.string().min(1, 'Invoice ID is required'),
  client_name: z.string().min(1, 'Client name is required'),
  client_email: z.string().optional().default(''),
  total: z.number().positive('Total must be greater than 0'),
  currency: z.string().optional().default('USD'),
  due_date: z.string().optional(),
  days_overdue: z.number().int().nonnegative().optional().default(0),
  line_items_summary: z.string().optional().default('Freelance services'),
  paypal_pay_url: z.string().optional().default(''),
  tone: z.enum(['Polite', 'Firm', 'Final'], {
    errorMap: () => ({ message: 'Invalid tone. Must be Polite, Firm, or Final.' }),
  }),
});

type ReminderRequest = z.infer<typeof ReminderRequestSchema>;

function isPlaceholder(val: string | undefined): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  return trimmed === '' || trimmed === 'your_gemini_api_key_here' || trimmed.length < 10;
}

function generateFallbackReminder(req: ReminderRequest): { subject: string; body: string } {
  const { invoice_id, client_name, total, days_overdue, line_items_summary, paypal_pay_url, tone } = req;
  const cleanName = client_name.split('(')[0].trim() || 'Client';
  const totalFormatted = formatUSD(total);
  const payLinkText = paypal_pay_url ? `\n\nYou can review and pay securely via PayPal here:\n${paypal_pay_url}` : '';

  if (tone === 'Polite') {
    return {
      subject: `Friendly check-in regarding Invoice ${invoice_id} for ${client_name}`,
      body:
        `Hi ${cleanName},\n\n` +
        `I hope you're having a great week! Just a friendly check-in regarding invoice ${invoice_id} for ${totalFormatted} (${line_items_summary})` +
        (days_overdue > 0 ? `, which was due ${days_overdue} day${days_overdue !== 1 ? 's' : ''} ago.` : ' which is coming due soon.') +
        `\n\nI understand that schedules get hectic and this might have simply slipped through. Please let me know if you have any questions or need another copy of the deliverables.` +
        `${payLinkText}\n\n` +
        `Thank you for your partnership!\n\n` +
        `Best regards,\nInvoicePilot`,
    };
  }

  if (tone === 'Firm') {
    return {
      subject: `Payment reminder: Invoice ${invoice_id} is ${days_overdue > 0 ? `${days_overdue} days ` : ''}past due (${totalFormatted})`,
      body:
        `Dear ${cleanName},\n\n` +
        `I am writing to follow up on outstanding invoice ${invoice_id} for ${totalFormatted} for ${line_items_summary}, which is currently ${days_overdue > 0 ? `${days_overdue} days ` : ''}past due.\n\n` +
        `Please arrange for payment of the balance (${totalFormatted}) at your earliest convenience or by end of week so we can keep account balances current.` +
        `${payLinkText}\n\n` +
        `If payment has already been initiated, please let me know. Otherwise, I appreciate your prompt attention to this matter.\n\n` +
        `Regards,\nInvoicePilot`,
    };
  }

  // Final tone
  return {
    subject: `FINAL NOTICE: Overdue Invoice ${invoice_id} (${totalFormatted}) - Settlement required`,
    body:
      `URGENT NOTICE TO ${client_name.toUpperCase()}:\n\n` +
      `This is our final notification regarding invoice ${invoice_id} in the amount of ${totalFormatted} (${line_items_summary}), which is now ${days_overdue > 0 ? `${days_overdue} days ` : ''}overdue without payment received.\n\n` +
      `Please remit the full balance of ${totalFormatted} within the next 48 hours to avoid potential account suspension, late assessment fees, or formal collection escalation.` +
      `${payLinkText}\n\n` +
      `If you have already sent this payment, please reply immediately with the transaction details so we can update our records.\n\n` +
      `Sincerely,\nInvoicePilot Collections`,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  const parsed = ReminderRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join('; ');
    return res.status(400).json({ ok: false, error: errorMsg });
  }

  const reminderData = parsed.data;
  const apiKey = process.env.GEMINI_API_KEY;

  // Live Gemini call if real key present
  if (!isPlaceholder(apiKey)) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey!,
      )}`;

      const promptText =
        `You are InvoicePilot AI assistant. Draft a professional payment reminder email.\n\n` +
        `Parameters:\n` +
        `- Client Name: ${reminderData.client_name}\n` +
        `- Invoice ID: ${reminderData.invoice_id}\n` +
        `- Total: ${formatUSD(reminderData.total)}\n` +
        `- Days Overdue: ${reminderData.days_overdue}\n` +
        `- Services: ${reminderData.line_items_summary}\n` +
        `- Payment Link: ${reminderData.paypal_pay_url}\n` +
        `- Requested Tone: ${reminderData.tone} (Polite = warm check-in; Firm = direct, professional, end of week deadline; Final = urgent, 48-hour deadline, formal notice)\n\n` +
        `Return strict JSON with two keys: "subject" and "body".`;

      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                subject: { type: 'STRING' },
                body: { type: 'STRING' },
              },
              required: ['subject', 'body'],
            },
          },
        }),
      });

      if (response.ok) {
        interface GeminiResponse {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
        }
        const data = (await response.json()) as GeminiResponse;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsedResult = JSON.parse(text) as { subject?: string; body?: string };
          if (parsedResult.subject && parsedResult.body) {
            return res.status(200).json({
              ok: true,
              source: 'gemini',
              tone: reminderData.tone,
              subject: parsedResult.subject,
              body: parsedResult.body,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Gemini draft-reminder error, falling back to generator]:', err);
    }
  }

  // Deterministic fallback generator
  const result = generateFallbackReminder(reminderData);

  return res.status(200).json({
    ok: true,
    source: 'fallback_generator',
    tone: reminderData.tone,
    subject: result.subject,
    body: result.body,
  });
}
