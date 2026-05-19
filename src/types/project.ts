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

/** Full AI access: context, read, and write */
export interface NodePermissions {
  enabled: boolean;
}

export const DEFAULT_PERMISSIONS: NodePermissions = {
  enabled: false,
};

export const DEFAULT_ROOT_PERMISSIONS: NodePermissions = {
  enabled: true,
};
