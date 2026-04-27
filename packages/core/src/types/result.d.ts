/**
 * @module result
 * @description
 * الگوی Result<T,E> برای مدیریت خطای Functional در AWAF SDK.
 * تمام توابع public باید به جای throw از این الگو استفاده کنند.
 *
 * Result<T,E> Pattern for functional error handling in AWAF SDK.
 * All public functions must use this pattern instead of throwing.
 */
/** خطای پایه AWAF — تمام errorها از این ساختار پیروی می‌کنند */
export interface AWAFError {
    /** کد machine-readable (UPPER_SNAKE_CASE) */
    readonly code: string;
    /** پیام human-readable برای debugging */
    readonly message: string;
    /** اطلاعات اضافی بدون PII */
    readonly details?: Record<string, unknown>;
}
/**
 * نوع Result برای مدیریت موفقیت یا شکست عملیات.
 *
 * @template T - نوع داده در حالت موفقیت
 * @template E - نوع خطا (پیش‌فرض: AWAFError)
 *
 * @example
 * function divide(a: number, b: number): Result<number> {
 *   if (b === 0) return err({ code: 'DIV_BY_ZERO', message: 'Cannot divide by zero' });
 *   return ok(a / b);
 * }
 */
export type Result<T, E = AWAFError> = {
    readonly success: true;
    readonly data: T;
} | {
    readonly success: false;
    readonly error: E;
};
/**
 * ساخت یک Result موفق.
 *
 * @param data - داده موفقیت
 * @returns Result با success=true
 *
 * @example
 * return ok({ visitorId: 'v-abc123' });
 */
export declare function ok<T>(data: T): Result<T, never>;
/**
 * ساخت یک Result شکست‌خورده.
 *
 * @param error - شیء خطا
 * @returns Result با success=false
 *
 * @example
 * return err({ code: 'NOT_FOUND', message: 'Visitor not found' });
 */
export declare function err<E = AWAFError>(error: E): Result<never, E>;
/**
 * تبدیل داده یک Result موفق با تابع map.
 * اگر Result شکست‌خورده باشد، بدون تغییر برمی‌گردد.
 *
 * @param result - Result ورودی
 * @param fn - تابع تبدیل داده موفق
 * @returns Result جدید
 *
 * @example
 * const upper = map(ok('hello'), s => s.toUpperCase());
 * // upper.data === 'HELLO'
 */
export declare function mapResult<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E>;
/**
 * اجرای تابع روی داده Result موفق (flatMap / chain).
 * اگر Result شکست‌خورده باشد، بدون تغییر برمی‌گردد.
 *
 * @param result - Result ورودی
 * @param fn - تابع که Result جدید برمی‌گرداند
 * @returns Result جدید
 *
 * @example
 * const result = flatMapResult(parseJson(input), validate);
 */
export declare function flatMapResult<T, U, E>(result: Result<T, E>, fn: (data: T) => Result<U, E>): Result<U, E>;
/**
 * استخراج مقدار از Result یا برگرداندن مقدار پیش‌فرض.
 *
 * @param result - Result ورودی
 * @param defaultValue - مقدار پیش‌فرض در صورت شکست
 * @returns داده موفق یا مقدار پیش‌فرض
 *
 * @example
 * const value = getOrDefault(result, 'fallback');
 */
export declare function getOrDefault<T, E>(result: Result<T, E>, defaultValue: T): T;
/**
 * بررسی اینکه آیا Result موفق است.
 *
 * @param result - Result برای بررسی
 * @returns true اگر موفق
 */
export declare function isOk<T, E>(result: Result<T, E>): result is {
    success: true;
    data: T;
};
/**
 * بررسی اینکه آیا Result شکست‌خورده است.
 *
 * @param result - Result برای بررسی
 * @returns true اگر شکست‌خورده
 */
export declare function isErr<T, E>(result: Result<T, E>): result is {
    success: false;
    error: E;
};
//# sourceMappingURL=result.d.ts.map