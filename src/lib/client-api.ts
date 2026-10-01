"use client";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
  });
  if (!res.ok) {
    let message = `İstek başarısız (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // gövde JSON değil
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiGet = <T,>(path: string) => request<T>(path, { method: "GET" });
export const apiPost = <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", json: body });
export const apiPatch = <T,>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", json: body });
export const apiPut = <T,>(path: string, body?: unknown) => request<T>(path, { method: "PUT", json: body });
export const apiDelete = <T,>(path: string) => request<T>(path, { method: "DELETE" });
