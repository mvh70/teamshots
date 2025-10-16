export type ApiOk<T> = {
  success: true;
  code: string;
  tKey?: string;
  data?: T;
  meta?: unknown;
};

export type ApiErr = {
  success: false;
  code: string;
  tKey?: string;
  message?: string;
};

export function ok<T>(data?: T, code = 'OK', tKey?: string, meta?: unknown): ApiOk<T> {
  return { success: true, code, tKey, data, meta };
}

export function badRequest(code = 'INVALID_INPUT', tKey?: string, message?: string): ApiErr {
  return { success: false, code, tKey, message };
}

export function unauthorized(tKey?: string, message?: string): ApiErr {
  return { success: false, code: 'UNAUTHORIZED', tKey, message };
}

export function internal(message?: string, tKey?: string): ApiErr {
  return { success: false, code: 'INTERNAL_ERROR', tKey, message };
}


