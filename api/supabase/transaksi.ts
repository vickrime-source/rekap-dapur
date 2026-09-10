import handler from './[...path].js';

export default function transaksiHandler(req: any, res: any) {
  req.query = req.query || {};
  req.query.path = ['transaksi'];
  return handler(req, res);
}
