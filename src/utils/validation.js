import { z } from 'zod';

export const patientHistorySchema = z.object({
  patientInitials: z.string().max(8).optional().default(''),
  age: z
    .union([z.number().min(0).max(120), z.literal(''), z.null(), z.undefined()])
    .optional(),
  gender: z
    .enum(['FEMALE', 'MALE', 'OTHER', 'PREFER_NOT_TO_DISCLOSE', 'UNKNOWN'])
    .default('UNKNOWN'),
  fitzpatrickType: z
    .enum(['1', '2', '3', '4', '5', '6', 'UNKNOWN'])
    .default('UNKNOWN'),
  region: z.string().max(64).default('UNKNOWN'),
  diameterMm: z
    .union([z.number().min(0).max(200), z.literal(''), z.null(), z.undefined()])
    .optional(),
  personalSkinCancerHistory: z
    .enum(['YES', 'NO', 'UNKNOWN'])
    .default('UNKNOWN'),
  familySkinCancerHistory: z
    .enum(['YES', 'NO', 'UNKNOWN'])
    .default('UNKNOWN'),
  relevantMedicalHistory: z.string().max(500).optional().default(''),
  itch: z.enum(['YES', 'NO', 'UNKNOWN']).default('UNKNOWN'),
  itchSeverity: z
    .enum(['NONE', 'MILD', 'MODERATE', 'SEVERE', 'UNKNOWN'])
    .default('UNKNOWN'),
  lesionDuration: z
    .enum(['LESS_THAN_1_MONTH', '1_TO_6_MONTHS', '6_TO_12_MONTHS', 'OVER_1_YEAR', 'UNKNOWN'])
    .default('UNKNOWN'),
  grew: z.enum(['YES', 'NO', 'UNKNOWN']).default('UNKNOWN'),
  changed: z.enum(['YES', 'NO', 'UNKNOWN']).default('UNKNOWN'),
  hurt: z.enum(['YES', 'NO', 'UNKNOWN']).default('UNKNOWN'),
  bleed: z.enum(['YES', 'NO', 'UNKNOWN']).default('UNKNOWN'),
  elevation: z.enum(['YES', 'NO', 'UNKNOWN']).default('UNKNOWN'),
});

export function validateImageFileClient(file) {
  if (!file) return { valid: false, error: 'Please select a lesion image file.' };
  const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!allowed.includes(file.type)) {
    return {
      valid: false,
      error: 'Unsupported file format. Please upload a JPG, JPEG, or PNG image.',
    };
  }
  const maxBytes = 15 * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: 'Image exceeds the 15 MB upload limit.',
    };
  }
  if (file.size < 512) {
    return {
      valid: false,
      error: 'Image file appears empty or corrupted.',
    };
  }
  return { valid: true };
}
