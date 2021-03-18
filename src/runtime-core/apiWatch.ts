export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV
) => any

export type WatchStopHandle = () => any

export function watch<T = any>(
  source: T,
  cb: WatchCallback
): WatchStopHandle {
  return doWatch(source as any, cb)
}

function doWatch(
  source: object,
  cb: WatchCallback | null
): WatchStopHandle {
  let getter: () => any
  return getter
}