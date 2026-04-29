/**
 * @module orchestrator/machine
 * @description
 * **Hand-rolled, XState-v5-compatible state-machine interpreter.**
 *
 * The authoring shape mirrors XState v5 enough that a future migration
 * is mechanical (`createMachine({ id, initial, context, states, on,
 * guards, actions })`). The interpreter is ~300 LOC and ships zero
 * runtime deps — preserving the dependency-free posture of
 * `@alphabet/core`.
 *
 * Why not a real `xstate` dep? `xstate@^5` is ~30 KB minified and ships
 * a generator-based actor model that is overkill for our two machines
 * (`consentLadderMachine`, `adaptiveRenderMachine`). A 300-LOC
 * interpreter with the same authoring shape lets users *learn* XState
 * here and reuse the same mental model later.
 *
 * What's included:
 *   - `createMachine(definition)` — pure, side-effect-free builder.
 *   - `interpret(machine, options).start()` — actor with `send`,
 *     `subscribe`, `getSnapshot`, `stop`.
 *   - Guards via `guards: { name: (ctx, ev) => boolean }`.
 *   - Actions via `actions: { name: (ctx, ev) => Partial<ctx> }` —
 *     immutable context updates returned from action functions.
 *   - `entry`/`exit` action lists per state.
 *   - Mermaid `stateDiagram-v2` rendering via `toMermaid(machine)`.
 *
 * What's NOT included (deferred until XState parity is actually needed):
 *   - Hierarchical / parallel states.
 *   - Spawned child actors / `invoke`.
 *   - Eventless (`always`) transitions.
 *   - History states.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnyEvent {
  readonly type: string;
}

export type GuardFn<Ctx, Ev extends AnyEvent> = (ctx: Ctx, ev: Ev) => boolean;
export type ActionFn<Ctx, Ev extends AnyEvent> = (ctx: Ctx, ev: Ev) => Partial<Ctx> | void;

export interface TransitionDef<Ctx, Ev extends AnyEvent> {
  readonly target: string;
  /** Name of a guard registered in the machine's `guards` map. */
  readonly guard?: string;
  /** Names of actions registered in the machine's `actions` map. */
  readonly actions?: readonly string[];
  /** @internal pre-resolved (built by createMachine). */
  readonly _resolvedGuard?: GuardFn<Ctx, Ev>;
  /** @internal */
  readonly _resolvedActions?: readonly ActionFn<Ctx, Ev>[];
}

export interface StateDef<Ctx, Ev extends AnyEvent> {
  readonly entry?: readonly string[];
  readonly exit?: readonly string[];
  readonly on?: Readonly<Record<string, TransitionDef<Ctx, Ev> | TransitionDef<Ctx, Ev>[]>>;
}

export interface MachineDefinition<Ctx, Ev extends AnyEvent> {
  readonly id: string;
  readonly initial: string;
  readonly context: Ctx;
  readonly states: Readonly<Record<string, StateDef<Ctx, Ev>>>;
  readonly guards?: Readonly<Record<string, GuardFn<Ctx, Ev>>>;
  readonly actions?: Readonly<Record<string, ActionFn<Ctx, Ev>>>;
}

export interface Machine<Ctx, Ev extends AnyEvent> {
  readonly definition: MachineDefinition<Ctx, Ev>;
}

export interface Snapshot<Ctx> {
  readonly value: string;
  readonly context: Ctx;
}

export interface Actor<Ctx, Ev extends AnyEvent> {
  start(): Actor<Ctx, Ev>;
  stop(): void;
  send(event: Ev): Snapshot<Ctx>;
  getSnapshot(): Snapshot<Ctx>;
  subscribe(listener: (snapshot: Snapshot<Ctx>) => void): { unsubscribe: () => void };
}

// ─── createMachine ───────────────────────────────────────────────────────────

export function createMachine<Ctx, Ev extends AnyEvent>(
  definition: MachineDefinition<Ctx, Ev>,
): Machine<Ctx, Ev> {
  // Validate states (helpful errors at construction time).
  if (!(definition.initial in definition.states)) {
    throw new Error(
      `[machine ${definition.id}] initial state '${definition.initial}' is not declared in states`,
    );
  }
  for (const [name, st] of Object.entries(definition.states)) {
    if (st.on === undefined) continue;
    for (const [evType, transitions] of Object.entries(st.on)) {
      const list = Array.isArray(transitions) ? transitions : [transitions];
      for (const t of list) {
        if (!(t.target in definition.states)) {
          throw new Error(
            `[machine ${definition.id}] state '${name}' on '${evType}' targets unknown state '${t.target}'`,
          );
        }
        if (t.guard !== undefined && definition.guards?.[t.guard] === undefined) {
          throw new Error(
            `[machine ${definition.id}] guard '${t.guard}' (used in '${name}') is not registered`,
          );
        }
        for (const a of t.actions ?? []) {
          if (definition.actions?.[a] === undefined) {
            throw new Error(
              `[machine ${definition.id}] action '${a}' (used in '${name}.${evType}') is not registered`,
            );
          }
        }
      }
    }
    for (const a of st.entry ?? []) {
      if (definition.actions?.[a] === undefined) {
        throw new Error(
          `[machine ${definition.id}] entry action '${a}' (in '${name}') is not registered`,
        );
      }
    }
    for (const a of st.exit ?? []) {
      if (definition.actions?.[a] === undefined) {
        throw new Error(
          `[machine ${definition.id}] exit action '${a}' (in '${name}') is not registered`,
        );
      }
    }
  }
  return { definition };
}

// ─── interpret ───────────────────────────────────────────────────────────────

export interface InterpretOptions<Ctx> {
  /** Override the initial context (deep-merged on top of machine.context). */
  readonly context?: Partial<Ctx>;
  /** Override the initial state. */
  readonly initial?: string;
}

export function interpret<Ctx, Ev extends AnyEvent>(
  machine: Machine<Ctx, Ev>,
  options: InterpretOptions<Ctx> = {},
): Actor<Ctx, Ev> {
  const def = machine.definition;
  let value = options.initial ?? def.initial;
  let context: Ctx = mergeCtx(def.context, options.context);
  let started = false;
  let stopped = false;
  const listeners = new Set<(s: Snapshot<Ctx>) => void>();

  const runActions = (names: readonly string[] | undefined, ev: Ev): void => {
    if (names === undefined) return;
    for (const n of names) {
      const fn = def.actions?.[n];
      if (fn === undefined) continue;
      const patch = fn(context, ev);
      if (patch !== undefined && patch !== null) {
        context = mergeCtx(context, patch as Partial<Ctx>);
      }
    }
  };

  const notify = (): void => {
    if (listeners.size === 0) return;
    const snapshot: Snapshot<Ctx> = { value, context };
    for (const l of listeners) l(snapshot);
  };

  const initEvent = { type: 'xstate.init' } as unknown as Ev;
  const machineActor: Actor<Ctx, Ev> = {
    start(): Actor<Ctx, Ev> {
      if (started) return machineActor;
      started = true;
      runActions(def.states[value]?.entry, initEvent);
      notify();
      return machineActor;
    },
    stop(): void {
      stopped = true;
      listeners.clear();
    },
    send(event: Ev): Snapshot<Ctx> {
      if (!started || stopped) return { value, context };
      const stateDef = def.states[value];
      if (stateDef === undefined || stateDef.on === undefined) return { value, context };
      const candidates = stateDef.on[event.type];
      if (candidates === undefined) return { value, context };
      const list = Array.isArray(candidates) ? candidates : [candidates];
      for (const t of list) {
        if (t.guard !== undefined) {
          const fn = def.guards?.[t.guard];
          if (fn !== undefined && !fn(context, event)) continue;
        }
        // Take this transition.
        runActions(stateDef.exit, event);
        runActions(t.actions, event);
        value = t.target;
        runActions(def.states[value]?.entry, event);
        notify();
        break;
      }
      return { value, context };
    },
    getSnapshot(): Snapshot<Ctx> {
      return { value, context };
    },
    subscribe(listener): { unsubscribe: () => void } {
      listeners.add(listener);
      // XState v5 emits the current snapshot on subscribe.
      listener({ value, context });
      return {
        unsubscribe: (): void => {
          listeners.delete(listener);
        },
      };
    },
  };
  return machineActor;
}

function mergeCtx<Ctx>(base: Ctx, patch: Partial<Ctx> | undefined): Ctx {
  if (patch === undefined) return base;
  if (typeof base !== 'object' || base === null) return (patch as Ctx) ?? base;
  return { ...base, ...patch } as Ctx;
}

// ─── Mermaid rendering ───────────────────────────────────────────────────────

/**
 * Render a `stateDiagram-v2` Mermaid string for documentation. Edges
 * are labelled `event [guard]` and the initial state is connected from
 * `[*]`.
 */
export function toMermaid<Ctx, Ev extends AnyEvent>(machine: Machine<Ctx, Ev>): string {
  const def = machine.definition;
  const lines: string[] = ['stateDiagram-v2'];
  lines.push(`  [*] --> ${def.initial}`);
  for (const [name, st] of Object.entries(def.states)) {
    if (st.on === undefined) continue;
    for (const [evType, transitions] of Object.entries(st.on)) {
      const list = Array.isArray(transitions) ? transitions : [transitions];
      for (const t of list) {
        const label = t.guard !== undefined ? `${evType} [${t.guard}]` : evType;
        lines.push(`  ${name} --> ${t.target}: ${label}`);
      }
    }
  }
  return lines.join('\n');
}
