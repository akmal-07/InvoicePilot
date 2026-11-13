import { generateLineItemId } from '../types/invoice';
import type { LineItem } from '../types/invoice';

/** Parse result from the local prompt parser */
export interface ParsedPrompt {
  client_name: string;
  client_email: string;
  description: string;
  line_items: Omit<LineItem, 'id'>[];
  due_days: number;
  notes: string;
}

/**
 * Smart local parser — extracts invoice fields from a plain-language prompt.
 * This is the Bit 1 fallback before Gemini is wired in Bit 2.
 */
export function parsePromptLocally(text: string): ParsedPrompt {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      client_name: '',
      client_email: '',
      description: '',
      line_items: [{ description: '', quantity: 1, unit_price: 0 }],
      due_days: 7,
      notes: '',
    };
  }

  // Extract email
  const emailMatch = trimmed.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
  const client_email = emailMatch ? emailMatch[0] : '';

  // Extract client name — look for "client <Name>" or "for <Name>" patterns
  let client_name = '';
  const clientPatterns = [
    /client\s+(?:is\s+)?([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i,
    /for\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i,
    /(?:bill|invoice)\s+(?:to\s+)?([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i,
  ];
  for (const pat of clientPatterns) {
    const m = trimmed.match(pat);
    if (m) {
      client_name = m[1].trim();
      break;
    }
  }

  // Extract price — look for $amount or amount dollars
  let unit_price = 0;
  const priceMatch = trimmed.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  if (priceMatch) {
    unit_price = parseFloat(priceMatch[1].replace(/,/g, ''));
  } else {
    const wordPrice = trimmed.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:dollars?|usd)/i);
    if (wordPrice) {
      unit_price = parseFloat(wordPrice[1].replace(/,/g, ''));
    }
  }

  // Extract due days — "due in N days", "N day term", "net N"
  let due_days = 7;
  const dueMatch = trimmed.match(/(?:due\s+(?:in\s+)?|net\s*|within\s+)(\d+)\s*day/i);
  if (dueMatch) {
    due_days = parseInt(dueMatch[1], 10);
  }

  // Extract description — remove email, price, client, and due patterns to get the work description
  let description = trimmed
    .replace(/[\w.+-]+@[\w.-]+\.\w{2,}/g, '')
    .replace(/\$\s?[\d,]+(?:\.\d{1,2})?/g, '')
    .replace(/(?:due\s+(?:in\s+)?|net\s*|within\s+)\d+\s*days?/gi, '')
    .replace(/client\s+(?:is\s+)?[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*/gi, '')
    .replace(/,{2,}/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();

  // If no good description extracted, use a cleaned-up version of the whole prompt
  if (!description || description.length < 5) {
    description = trimmed.substring(0, 100);
  }

  const line_items: Omit<LineItem, 'id'>[] = [
    {
      description,
      quantity: 1,
      unit_price,
    },
  ];

  return {
    client_name,
    client_email,
    description,
    line_items,
    due_days,
    notes: '',
  };
}

/** Sample prompts for the Create Invoice screen */
export const SAMPLE_PROMPTS = [
  'Logo for cafe, 3 revisions, $200, due in 7 days, client Priya Sharma, priya@example.com',
  'WordPress site migration + SEO audit, $1200, due in 14 days, client Jordan Lee, jordan@greenleaf.example.com',
  'Product photography, 25 shots, $350, due in 5 days, client Mia Chen, mia@bloombox.example.com',
];

/** Add IDs to parsed line items */
export function addLineItemIds(items: Omit<LineItem, 'id'>[]): LineItem[] {
  return items.map((item) => ({ ...item, id: generateLineItemId() }));
}

