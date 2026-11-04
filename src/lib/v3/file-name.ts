/** A long file name on one line: its start, an ellipsis, and its extension. */
export function shortFileName(name: string, max = 32) {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : "";
  return `${name.slice(0, max - extension.length - 1)}…${extension}`;
}
