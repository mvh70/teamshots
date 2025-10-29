export class AppError extends Error {
  public readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found') {
    super('NOT_FOUND', message)
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation Error') {
    super('VALIDATION_ERROR', message)
  }
}


