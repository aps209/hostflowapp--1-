export const isPlatformAdmin = (user: any) => user?.is_platform_admin === true;

export const isRestaurantAdmin = (user: any) => ["admin", "CEO"].includes(user?.role);

export const hasPermission = (user: any, permission: string) =>
  user?.is_platform_admin === true || (user?.permissions || []).includes(permission);
