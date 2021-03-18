import { hasChange, hasOwn, isArray } from "../shared"
import { track, trigger } from "./effect";
import { ReactiveFlags, reactiveMap, readonlyMap, Target, toRaw } from "./reactive"

const arrayInstrumentations: Record<string, Function> = {}

;(['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach(key => {
  const method = Array.prototype[key] as any
  arrayInstrumentations[key] = function(this: unknown[], ...args: unknown[]) {
    // pauseTracking()
    const res = method.apply(this, args)
    // resetTracking()
    return res
  }
})

function createGetter(
  isReadonly: boolean = false
) {
  return function get(
    target: Target,
    key: string,
    receiver: object
  ) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    } else if (
      key === ReactiveFlags.RAW &&
      receiver === (isReadonly ? readonlyMap : reactiveMap).get(target)
    ) {
      return target
    }

    const targetIsArray = isArray(target)

    if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver)
    }

    const res = Reflect.get(target, key, receiver)

    if (!isReadonly) {
      track(target, key)
    }

    return res
  }
}

function createSetter(
  shallow = false
) {
  return function set(
    target: object,
    key: string,
    value: unknown,
    receiver: object
  ): boolean {
    const oldValue = (target as any)[key]
    const result = Reflect.set(target, key, value, receiver)
    if (target === toRaw(receiver)) {
      if (hasChange(value, oldValue)) {
        trigger(target, key)
      }
    }
    return result
  }
}

const get = createGetter()
const set = createSetter()

export const mutableHandlers: ProxyHandler<object> = {
  get,
  set
}