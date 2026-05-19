export interface Project {
  id: string;
  name: string;
  rootPath: string;
  addedAt: number;
}

export interface FsEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface NodePermissions {
  inContext: boolean;
  canRead: boolean;
  canWrite: boolean;
}

export const DEFAULT_PERMISSIONS: NodePermissions = {
  inContext: false,
  canRead: false,
  canWrite: false,
};

export const DEFAULT_ROOT_PERMISSIONS: NodePermissions = {
  inContext: true,
  canRead: true,
  canWrite: false,
};
