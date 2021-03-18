type Dep = Set<ReactiveEffect>
type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

export interface ReactiveEffect<T = any> {
  (): T
  id: number
  deps: Array<Dep>
}

const effectStack: ReactiveEffect[] = []
let activeEffect: ReactiveEffect | undefined

export function effect<T = any>(
  fn: () => T
): ReactiveEffect<T> {
  const effect = createReactiveEffect(fn)
  effect()
  return effect
}

let uid = 0

function createReactiveEffect<T = any>(
  fn: () => T
): ReactiveEffect<T> {
  const effect = function reactiveEffect(): unknown {
    if (!effectStack.includes(effect)) {
      cleanup(effect)
      try {
        effectStack.push(effect)
        activeEffect = effect
        return fn()
      } finally {
        effectStack.pop()
        activeEffect = effectStack[effectStack.length - 1]
      }
    }
  } as ReactiveEffect
  effect.id = uid++
  effect.deps = []
  return effect
}

function cleanup(effect: ReactiveEffect) {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

export function track(
  target: object,
  key: unknown
) {
  if (activeEffect === undefined) {
    return
  }
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}

export function trigger(
  target: object,
  key?: unknown
) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  const effects = new Set<ReactiveEffect>()
  const add = (effectsToAdd: Set<ReactiveEffect> | undefined) => {
    if (effectsToAdd) {
      effectsToAdd.forEach(effect => {
        if (effect !== activeEffect) {
          effects.add(effect)
        }
      })
    }
  }

  if (key !== void 0) {
    add(depsMap.get(key))
  }

  const run = (effect: ReactiveEffect) => {
    effect()
  }

  effects.forEach(run)
}