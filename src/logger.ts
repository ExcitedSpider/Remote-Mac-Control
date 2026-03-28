function format(level: string, msg: string): string {
  return `${new Date().toISOString()} [${level}] ${msg}`;
}

export const log = {
  info: (...args: unknown[]) => console.log(format("INFO", args.join(" "))),
  warn: (...args: unknown[]) => console.log(format("WARN", args.join(" "))),
  error: (...args: unknown[]) => console.error(format("ERROR", args.join(" "))),
};
