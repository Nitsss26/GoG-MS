/** Dress code rejection reasons (shared by the reject dialog and the server) */
export const DRESS_CODE_REASONS = ['Footwear', 'Blazer', 'Waistcoat', 'Grooming', 'Full Attire', 'Other'] as const;

/** "Footwear, Blazer, Other: <text>" */
export function dressReasonText(reasons?: string[], other?: string) {
    return (reasons || []).map(r => (r === 'Other' && other ? `Other: ${other}` : r)).join(', ');
}