import { useAppStore } from '../../store/useAppStore';
import { type UserRole, ROLE_PERMISSIONS } from '../../lib/rbac';

export function PermissionGate({
  permission,
  children,
  fallback = null
}: {
  permission: keyof typeof ROLE_PERMISSIONS.admin;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { user } = useAppStore();
  const role = (user?.role as UserRole) || 'front_desk';
  const hasPermission = ROLE_PERMISSIONS[role]?.[permission] ?? false;

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
