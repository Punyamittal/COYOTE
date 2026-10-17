export type ViewerAccess = {
  canCreateEvents: boolean;
  canEditEvents: boolean;
  canDeleteEvents: boolean;
  canImportEvents: boolean;
  canManageUsers: boolean;
};

export const noAccess: ViewerAccess = {
  canCreateEvents: false,
  canEditEvents: false,
  canDeleteEvents: false,
  canImportEvents: false,
  canManageUsers: false,
};
