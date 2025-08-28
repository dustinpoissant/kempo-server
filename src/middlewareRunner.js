// Middleware runner for Kempo Server
export default class MiddlewareRunner {
  constructor() {
    this.middlewares = [];
  }

  use(middleware) {
    this.middlewares.push(middleware);
  }

  async run(req, res, finalHandler) {
    let index = 0;
    
    const next = async () => {
      if (index >= this.middlewares.length) {
        return await finalHandler();
      }
      
      const middleware = this.middlewares[index++];
      await middleware(req, res, next);
    };
    
    await next();
  }
}
