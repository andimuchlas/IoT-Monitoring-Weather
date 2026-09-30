export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, any> | Array<any>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export abstract class BaseService {
  protected badRequest(code: string, message: string, details?: any): never {
    throw new AppError(400, code, message, details);
  }

  protected unauthorized(code = "UNAUTHORIZED", message = "Unauthorized access"): never {
    throw new AppError(401, code, message);
  }

  protected forbidden(code = "FORBIDDEN", message = "Access denied"): never {
    throw new AppError(403, code, message);
  }

  protected notFound(code: string, message: string): never {
    throw new AppError(404, code, message);
  }

  protected conflict(code: string, message: string, details?: any): never {
    throw new AppError(409, code, message, details);
  }

  protected unprocessableEntity(code: string, message: string, details?: any): never {
    throw new AppError(422, code, message, details);
  }

  protected success<T>(data: T, message = "Success") {
    return {
      success: true,
      message,
      data,
    };
  }
}
