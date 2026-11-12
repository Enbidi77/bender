export const promises = {
  readFile: async () => '',
  writeFile: async () => {},
  mkdir: async () => {},
  access: async () => {},
  unlink: async () => {},
};

export const readFile = async () => '';
export const writeFile = async () => {};
export const mkdir = async () => {};
export const access = async () => {};
export const unlink = async () => {};

export const dirname = (p: string) => {
  const parts = p.split(/[/\\]/);
  parts.pop();
  return parts.join('/') || '.';
};

export const basename = (p: string, ext?: string) => {
  const name = p.split(/[/\\]/).pop() || '';
  if (ext && name.endsWith(ext)) {
    return name.slice(0, -ext.length);
  }
  return name;
};

export const join = (...paths: string[]) => {
  return paths.filter(Boolean).join('/').replace(/\/+/g, '/');
};

export const resolve = (...paths: string[]) => {
  return join(...paths);
};

export default {
  promises,
  readFile,
  writeFile,
  mkdir,
  access,
  unlink,
  dirname,
  basename,
  join,
  resolve,
};
