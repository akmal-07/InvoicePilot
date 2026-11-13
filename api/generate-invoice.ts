import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GeminiDraftSchema } from '../src/types/invoice';
import { recomputeTotals } from '../src/utils/invoiceMath';
import { parsePromptLocally } from '../src/utils/promptParser';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  const prompt = (req.body as { prompt?: unknown })?.prompt;

  // ── Validation: Non-empty string, min 5, max 2000 chars ─────
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.trim().length < 5) {
    return res.status(400).json({
      ok: false,
      error: 'Please describe the work to generate an invoice.',
    });
  }

  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length > 2000) {
    return res.status(400).json({
      ok: false,
      error: 'Prompt is too long (maximum 2000 characters).',
    });
  }

  // ── Validation: Gibberish input (e.g., "???", "....") ───────
  const alphaNumericMatches = trimmedPrompt.match(/[a-zA-Z0-9]/g) || [];
  if (alphaNumericMatches.length < 3) {
    return res.status(422).json({
      ok: false,
      error: 'Could not extract invoice details from the description. Please provide more details.',
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const isPlaceholderKey = !apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '';

  // ── Smart Sandbox/Quota Resilience: Fallback Parser ──────────
  if (isPlaceholderKey) {
    const parsed = parsePromptLocally(trimmedPrompt);

    // If description is empty or too short
    if (!parsed.description && parsed.line_items.every((i) => !i.description)) {
      return res.status(422).json({
        ok: false,
        error: 'Could not extract work items from the description. Please provide more details.',
      });
    }

    const draftData = {
      client_name: parsed.client_name || 'Valued Client',
      client_email: parsed.client_email || '',
      currency: 'USD' as const,
      line_items: parsed.line_items.map((li) => ({
        description: li.description || 'Freelance Services',
        quantity: Math.max(1, li.quantity || 1),
        unit_price: Math.max(0, li.unit_price || 0),
      })),
      tax_percent: 0,
      due_days: parsed.due_days || 7,
      notes: parsed.notes || 'Payment is due within agreed terms. Thank you for your business!',
    };

    const validated = GeminiDraftSchema.safeParse(draftData);
    if (!validated.success) {
      return res.status(422).json({
        ok: false,
        error: 'Failed to structure invoice: ' + validated.error.issues.map((i) => i.message).join(', '),
      });
    }

    // Deterministic arithmetic in code
    const totals = recomputeTotals(validated.data.line_items, validated.data.tax_percent);

    return res.status(200).json({
      ok: true,
      source: 'fallback_parser',
      draft: {
        ...validated.data,
        ...totals,
      },
    });
  }

  // ── Live Gemini API Call (gemini-2.5-flash) ───────────────────
  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
      apiKey,
    )}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  'You are InvoicePilot AI. Convert the following freelance work description into a structured invoice JSON. ' +
                  'Extract client_name (default "Valued Client" if omitted), client_email (empty string if omitted), currency ("USD"), ' +
                  'line_items (array of objects with description, quantity >= 1, unit_price >= 0), tax_percent (0-100, default 0), ' +
                  'due_days (integer 1-365, default 7), and concise professional notes.\n\n' +
                  'Work Description:\n' +
                  trimmedPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              client_name: { type: 'STRING' },
              client_email: { type: 'STRING' },
              currency: { type: 'STRING', enum: ['USD'] },
              line_items: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    description: { type: 'STRING' },
                    quantity: { type: 'NUMBER' },
                    unit_price: { type: 'NUMBER' },
                  },
                  required: ['description', 'quantity', 'unit_price'],
                },
              },
              tax_percent: { type: 'NUMBER' },
              due_days: { type: 'INTEGER' },
              notes: { type: 'STRING' },
            },
            required: [
              'client_name',
              'client_email',
              'currency',
              'line_items',
              'tax_percent',
              'due_days',
              'notes',
            ],
          },
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(`[Gemini API] Error status ${response.status}: ${errBody}`);
      // Fallback if quota exceeded or server error
      if (response.status === 429 || response.status >= 500) {
        const parsed = parsePromptLocally(trimmedPrompt);
        const draftData = {
          client_name: parsed.client_name || 'Valued Client',
          client_email: parsed.client_email || '',
          currency: 'USD' as const,
          line_items: parsed.line_items.map((li) => ({
            description: li.description || 'Freelance Services',
            quantity: Math.max(1, li.quantity || 1),
            unit_price: Math.max(0, li.unit_price || 0),
          })),
          tax_percent: 0,
          due_days: parsed.due_days || 7,
          notes: parsed.notes || 'Payment is due within agreed terms. Thank you for your business!',
        };
        const validated = GeminiDraftSchema.parse(draftData);
        const totals = recomputeTotals(validated.line_items, validated.tax_percent);
        return res.status(200).json({
          ok: true,
          source: 'fallback_parser',
          draft: { ...validated, ...totals },
        });
      }
      return res.status(response.status).json({
        ok: false,
        error: `Gemini API returned status ${response.status}`,
      });
    }

    interface GeminiCandidatePart {
      text?: string;
    }
    interface GeminiCandidateContent {
      parts?: GeminiCandidatePart[];
    }
    interface GeminiCandidate {
      content?: GeminiCandidateContent;
    }
    interface GeminiApiResponse {
      candidates?: GeminiCandidate[];
    }

    const data = (await response.json()) as GeminiApiResponse;
    const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawJsonText) {
      return res.status(422).json({
        ok: false,
        error: 'Gemini returned an empty response.',
      });
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawJsonText);
    } catch {
      return res.status(422).json({
        ok: false,
        error: 'Gemini response was not valid JSON.',
      });
    }

    const validated = GeminiDraftSchema.safeParse(parsedJson);
    if (!validated.success) {
      return res.status(422).json({
        ok: false,
        error: 'AI output failed schema validation: ' + validated.error.issues.map((i) => i.message).join(', '),
      });
    }

    // Deterministic arithmetic in code
    const totals = recomputeTotals(validated.data.line_items, validated.data.tax_percent);

    return res.status(200).json({
      ok: true,
      source: 'gemini',
      draft: {
        ...validated.data,
        ...totals,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Gemini API] Request exception:', message);
    return res.status(500).json({
      ok: false,
      error: `Failed to generate invoice: ${message}`,
    });
  }
}

