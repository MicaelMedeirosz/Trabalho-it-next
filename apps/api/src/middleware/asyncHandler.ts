import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Express 4 não captura erros lançados/rejeitados em handlers async — viram
 * unhandled rejection e o Node 20+ encerra o processo inteiro. Este wrapper
 * encaminha qualquer rejeição ao next(err), caindo no error handler global
 * (resposta HTTP 500) em vez de derrubar o servidor.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
