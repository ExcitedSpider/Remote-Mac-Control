function format(level, msg) {
  return `${new Date().toISOString()} [${level}] ${msg}`;
}

export const log = {
  info: (...args) => console.log(format("INFO", args.join(" "))),
  warn: (...args) => console.log(format("WARN", args.join(" "))),
  error: (...args) => console.error(format("ERROR", args.join(" "))),
};
