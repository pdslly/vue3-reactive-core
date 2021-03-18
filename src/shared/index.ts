const hasOwnProperty = Object.prototype.hasOwnProperty
export const objectToString = Object.prototype.toString
export const toTypeString = (value: unknown): string =>
  objectToString.call(value)
export const hasOwn = (
  val: object,
  key: string
): key is keyof typeof val => hasOwnProperty.call(val, key)
export const extend = Object.assign
export const isArray = Array.isArray
export const isObject = (val: unknown): val is Record<any, any> => val !== null && typeof val === 'object'
export const hasChange = (val: any, oldVal: any): boolean => val !== oldVal && (val === val || oldVal === oldVal)
export const isMap = (val: unknown): val is Map<any, any> => toTypeString(val) === '[object Map]'