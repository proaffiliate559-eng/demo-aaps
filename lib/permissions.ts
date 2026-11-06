// UI-side copy of private.role_perms. The database is the source of truth:
// these only decide what to show; every action is re-checked in SQL.
export type Role = 'owner' | 'manager' | 'cashier' | 'marketing';
export type Permission =
  | 'view_dashboard'
  | 'view_customers'
  | 'manage_customers'
  | 'register_customers'
  | 'record_purchases'
  | 'redeem_rewards'
  | 'create_campaigns'
  | 'manage_loyalty'
  | 'manage_qr'
  | 'manage_branches'
  | 'manage_staff'
  | 'manage_billing'
  | 'manage_settings';

const ALL: Permission[] = [
  'view_dashboard', 'view_customers', 'manage_customers', 'register_customers', 'record_purchases',
  'redeem_rewards', 'create_campaigns', 'manage_loyalty', 'manage_qr', 'manage_branches',
  'manage_staff', 'manage_billing', 'manage_settings',
];

export const ROLE_PERMS: Record<Role, Permission[]> = {
  owner: ALL,
  manager: ALL.filter((p) => p !== 'manage_staff' && p !== 'manage_billing'),
  cashier: ['view_customers', 'register_customers', 'record_purchases', 'redeem_rewards'],
  marketing: ['view_dashboard', 'view_customers', 'create_campaigns'],
};

export const can = (role: Role | null | undefined, perm: Permission) => !!role && ROLE_PERMS[role].includes(perm);
