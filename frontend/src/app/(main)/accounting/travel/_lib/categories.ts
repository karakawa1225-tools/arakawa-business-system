export const TRAVEL_LINE_CATEGORIES = [
  { value: 'transport', label: '交通費' },
  { value: 'lodging', label: '宿泊費' },
  { value: 'per_diem', label: '日当' },
  { value: 'meals', label: '食事代' },
  { value: 'other', label: 'その他' },
] as const;

export type TravelLineCategory = (typeof TRAVEL_LINE_CATEGORIES)[number]['value'];
