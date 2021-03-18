import { hasChange, isObject } from "../shared"
import { track, trigger } from "./effect"
import { reactive } from "./reactive"

export interface Ref<T = any> {
  value: T
  _shallow?: boolean
}

const convert = <T extends unknown>(val: T): T => isObject(val) ? reactive(val as object) : val

export function isRef(r: any): r is Ref {
  return Boolean(r && r.__v_isRef === true)
}

class RefImpl<T> {
  private _value: T

  public readonly __v_isRef = true

  constructor(private _rawValue: T, public readonly _shallow = false) {
    this._value = _shallow ? _rawValue : convert(_rawValue)
  }

  get value() {
    track(this, 'value')
    return this._value
  }

  set value(newVal) {
   if (hasChange(newVal, this._rawValue)) {
     this._rawValue = newVal
     this._value = this._shallow ? newVal : convert(newVal)
     trigger(this, 'value')
   } 
  }
}

function createRef(rawValue: unknown, shallow = false) {
  if (isRef(rawValue)) {
    return rawValue
  }
  return new RefImpl(rawValue, shallow)
}

export function ref(value?: unknown) {
  return createRef(value)
}