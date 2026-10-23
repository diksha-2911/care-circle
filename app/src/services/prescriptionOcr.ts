import { supabase } from './supabase';

export type OcrSuggestion = {
  drug_name: string | null;
  dosage: string | null;
  frequency_per_day: number | null;
  quantity_remaining: number | null;
  alarm_times: string[];
};

export type PrescriptionOcrResult = {
  extractedText: string;
  suggestions: OcrSuggestion;
  warnings: string[];
};

const OCR_URL = process.env.EXPO_PUBLIC_PRESCRIPTION_OCR_URL;

export async function extractPrescriptionText(args: {
  circleId: string;
  base64: string;
  mimeType?: string | null;
  fileName?: string | null;
}): Promise<PrescriptionOcrResult> {
  if (!OCR_URL) {
    throw new Error('OCR endpoint is not configured. Set EXPO_PUBLIC_PRESCRIPTION_OCR_URL.');
  }
  if (!args.base64) throw new Error('The selected image could not be read. Please choose it again.');

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Please sign in again before scanning a prescription.');

  const response = await fetch(OCR_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      circleId: args.circleId,
      imageBase64: args.base64,
      mimeType: args.mimeType ?? 'image/jpeg',
      fileName: args.fileName ?? 'prescription.jpg',
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ?? `Prescription OCR failed (${response.status}).`);
  }
  if (typeof payload?.extractedText !== 'string') {
    throw new Error('The OCR service returned an unexpected response.');
  }

  return {
    extractedText: payload.extractedText,
    suggestions: {
      drug_name: payload?.suggestions?.drug_name ?? null,
      dosage: payload?.suggestions?.dosage ?? null,
      frequency_per_day: Number.isInteger(payload?.suggestions?.frequency_per_day)
        ? payload.suggestions.frequency_per_day
        : null,
      quantity_remaining: Number.isInteger(payload?.suggestions?.quantity_remaining)
        ? payload.suggestions.quantity_remaining
        : null,
      alarm_times: Array.isArray(payload?.suggestions?.alarm_times)
        ? payload.suggestions.alarm_times.filter((v: unknown): v is string => typeof v === 'string')
        : [],
    },
    warnings: Array.isArray(payload?.warnings)
      ? payload.warnings.filter((v: unknown): v is string => typeof v === 'string')
      : [],
  };
}
