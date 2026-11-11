export const promises = {
  readFile: async () => '',
  writeFile: async () => {},
  mkdir: async () => {},
  access: async () => {},
  unlink: async () => {},
};

export const dirname = (p: string) => {
  const parts = p.split(/[/\\]/);
  parts.pop();
  return parts.join('/') || '.';
};

export default { promises, dirname };
