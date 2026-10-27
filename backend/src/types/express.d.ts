declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tokenVersion: number;
      };
    }
  }
}

export {};
