export const isPlatformAdmin = (user: any) => user?.is_platform_admin === true;

export const isRestaurantAdmin = (user: any) => user?.role === "admin";
