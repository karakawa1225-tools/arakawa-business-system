import jwt from 'jsonwebtoken';

export type StaffPayload = {
  sub: string;
  companyId: string;
  role: string;
  type: 'staff';
};

export type CustomerPayload = {
  sub: string;
  companyId: string;
  customerId: string;
  type: 'customer';
};

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET が設定されていません');
  return s;
};

export function signStaffToken(payload: Omit<StaffPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'staff' }, secret(), { expiresIn: '7d' });
}

export function signCustomerToken(payload: Omit<CustomerPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'customer' }, secret(), { expiresIn: '30d' });
}

export function verifyToken(token: string): StaffPayload | CustomerPayload {
  return jwt.verify(token, secret()) as StaffPayload | CustomerPayload;
}
