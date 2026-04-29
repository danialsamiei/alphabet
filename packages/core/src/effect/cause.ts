/**
 * @module effect/cause
 * @description
 * `Cause<E>` — the failure tree of an `Effect<R, E, A>`. Distinguishes
 * **expected failures** (`Fail<E>` — domain errors known at the type
 * level) from **defects** (`Die` — programmer errors / thrown JS) and
 * **interruptions** (`Interrupt` — cooperative cancellation via
 * `AbortSignal`).
 *
 * This separation matters because `catchAll` only recovers from `Fail`
 * (the expected branch). Defects bubble up unchanged so a bug never gets
 * silently swallowed.
 *
 * Cause is closed under **sequential composition** (`then`, used when one
 * step finalizer fails after another) and **parallel composition** (`both`,
 * used by `Effect.all` / `race`). Pretty printers and folds are provided
 * for tooling.
 */

// ─── Tagged union ────────────────────────────────────────────────────────────

export type Cause<E> =
  | { readonly _tag: 'Empty' }
  | { readonly _tag: 'Fail'; readonly error: E }
  | { readonly _tag: 'Die'; readonly defect: unknown }
  | { readonly _tag: 'Interrupt' }
  | { readonly _tag: 'Then'; readonly left: Cause<E>; readonly right: Cause<E> }
  | { readonly _tag: 'Both'; readonly left: Cause<E>; readonly right: Cause<E> };

// ─── Constructors ────────────────────────────────────────────────────────────

export const causeEmpty: Cause<never> = { _tag: 'Empty' };

export function causeFail<E>(error: E): Cause<E> {
  return { _tag: 'Fail', error };
}

export function causeDie(defect: unknown): Cause<never> {
  return { _tag: 'Die', defect };
}

export const causeInterrupt: Cause<never> = { _tag: 'Interrupt' };

export function causeThen<E>(left: Cause<E>, right: Cause<E>): Cause<E> {
  if (left._tag === 'Empty') return right;
  if (right._tag === 'Empty') return left;
  return { _tag: 'Then', left, right };
}

export function causeBoth<E>(left: Cause<E>, right: Cause<E>): Cause<E> {
  if (left._tag === 'Empty') return right;
  if (right._tag === 'Empty') return left;
  return { _tag: 'Both', left, right };
}

// ─── Predicates ──────────────────────────────────────────────────────────────

/** True iff this cause contains at least one `Fail`. */
export function causeIsFail<E>(c: Cause<E>): boolean {
  switch (c._tag) {
    case 'Fail':
      return true;
    case 'Then':
    case 'Both':
      return causeIsFail(c.left) || causeIsFail(c.right);
    default:
      return false;
  }
}

/** True iff this cause contains at least one `Die` (defect). */
export function causeIsDie<E>(c: Cause<E>): boolean {
  switch (c._tag) {
    case 'Die':
      return true;
    case 'Then':
    case 'Both':
      return causeIsDie(c.left) || causeIsDie(c.right);
    default:
      return false;
  }
}

/** True iff this cause contains an interruption. */
export function causeIsInterrupted<E>(c: Cause<E>): boolean {
  switch (c._tag) {
    case 'Interrupt':
      return true;
    case 'Then':
    case 'Both':
      return causeIsInterrupted(c.left) || causeIsInterrupted(c.right);
    default:
      return false;
  }
}

/** Collect every `Fail` error reachable from this cause, in left-to-right order. */
export function causeFailures<E>(c: Cause<E>): readonly E[] {
  const out: E[] = [];
  const stack: Cause<E>[] = [c];
  while (stack.length > 0) {
    const node = stack.pop() as Cause<E>;
    switch (node._tag) {
      case 'Fail':
        out.push(node.error);
        break;
      case 'Then':
      case 'Both':
        // push right second so left is processed first (DFS, left-to-right)
        stack.push(node.right);
        stack.push(node.left);
        break;
      default:
        break;
    }
  }
  return out;
}

/** Collect every defect (Die.defect) reachable from this cause. */
export function causeDefects<E>(c: Cause<E>): readonly unknown[] {
  const out: unknown[] = [];
  const stack: Cause<E>[] = [c];
  while (stack.length > 0) {
    const node = stack.pop() as Cause<E>;
    switch (node._tag) {
      case 'Die':
        out.push(node.defect);
        break;
      case 'Then':
      case 'Both':
        stack.push(node.right);
        stack.push(node.left);
        break;
      default:
        break;
    }
  }
  return out;
}

/** Pretty render, deterministic, PII-free for `E` only if `E` is. */
export function causePretty<E>(c: Cause<E>, indent = 0): string {
  const pad = '  '.repeat(indent);
  switch (c._tag) {
    case 'Empty':
      return `${pad}<empty>`;
    case 'Fail':
      return `${pad}Fail(${stringify(c.error)})`;
    case 'Die':
      return `${pad}Die(${stringify(c.defect)})`;
    case 'Interrupt':
      return `${pad}Interrupt`;
    case 'Then':
      return `${pad}Then\n${causePretty(c.left, indent + 1)}\n${causePretty(c.right, indent + 1)}`;
    case 'Both':
      return `${pad}Both\n${causePretty(c.left, indent + 1)}\n${causePretty(c.right, indent + 1)}`;
  }
}

function stringify(v: unknown): string {
  if (v instanceof Error) return v.message;
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
