/**
 * @module benchmarks/helpers
 * @description
 * Shared helpers for AWAF microbenchmarks.
 *
 * - `formatTask(...)` — pretty-print a single tinybench task row.
 * - `runSuite(...)` — run a `Bench`, sort the results by mean, and print
 *   them as a table along with whether each task met its declared budget.
 * - `Budget` — declarative per-task latency budget (mean ms).
 */

import type { Bench } from 'tinybench';

export interface Budget {
  /** Mean latency budget in milliseconds. Mean must be < this value. */
  readonly meanMs: number;
}

export type Budgets = Readonly<Record<string, Budget>>;

export interface SuiteOptions {
  readonly name: string;
  readonly budgets?: Budgets;
  /** When true (smoke mode), use very short iterations for CI sanity. */
  readonly smoke?: boolean;
}

export interface TaskRow {
  readonly name: string;
  readonly meanMs: number;
  readonly hz: number;
  readonly samples: number;
  readonly budgetMs?: number;
  readonly withinBudget?: boolean;
}

export interface SuiteResult {
  readonly name: string;
  readonly rows: readonly TaskRow[];
  readonly violations: readonly TaskRow[];
}

/** Read smoke flag from process.argv. */
export function isSmokeRun(argv: readonly string[] = process.argv): boolean {
  return argv.includes('--smoke');
}

/** Build sensible Bench options based on smoke vs full mode. */
export function benchOptions(smoke: boolean): { time: number; iterations: number; warmupIterations: number } {
  if (smoke) {
    return { time: 50, iterations: 50, warmupIterations: 10 };
  }
  return { time: 500, iterations: 200, warmupIterations: 50 };
}

/**
 * Run a tinybench `Bench` and produce a structured table. Returns the
 * collected rows and any tasks that violated declared budgets so callers
 * can decide whether to exit non-zero.
 */
export async function runBench(bench: Bench, options: SuiteOptions): Promise<SuiteResult> {
  await bench.warmup();
  await bench.run();

  const rows: TaskRow[] = [];
  const violations: TaskRow[] = [];
  const budgets = options.budgets ?? {};

  for (const task of bench.tasks) {
    const result = task.result;
    if (!result) continue;
    const meanMs = result.mean;
    const hz = result.hz;
    const samples = result.samples.length;
    const budget = budgets[task.name];
    const row: TaskRow = budget
      ? {
          name: task.name,
          meanMs,
          hz,
          samples,
          budgetMs: budget.meanMs,
          withinBudget: meanMs < budget.meanMs,
        }
      : { name: task.name, meanMs, hz, samples };
    rows.push(row);
    if (row.withinBudget === false) violations.push(row);
  }

  rows.sort((a, b) => a.meanMs - b.meanMs);
  return { name: options.name, rows, violations };
}

/** Pretty-print a SuiteResult to stdout. */
export function printSuite(result: SuiteResult): void {
  const headerLabel = `── ${result.name} ${'─'.repeat(Math.max(2, 60 - result.name.length))}`;
  // eslint-disable-next-line no-console
  console.log(`\n${headerLabel}`);
  for (const row of result.rows) {
    const mean = row.meanMs.toFixed(4);
    const ops = Math.round(row.hz).toLocaleString('en-US');
    const samples = row.samples.toString().padStart(4, ' ');
    const budget =
      row.budgetMs === undefined
        ? ''
        : row.withinBudget
          ? `  ✅ <${row.budgetMs}ms`
          : `  ❌ >=${row.budgetMs}ms`;
    // eslint-disable-next-line no-console
    console.log(`  ${row.name.padEnd(38, ' ')} mean=${mean}ms  ops/s=${ops}  n=${samples}${budget}`);
  }
}
