import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    clientIp: string;
    cfAccess?: {
      bypassed?: boolean;
      email?: string;
      identity?: Record<string, unknown>;
    };
  }
}
