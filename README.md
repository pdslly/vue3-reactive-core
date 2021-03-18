## 前言
我们都知道，Vue2里的响应式其实有点像半完全体，对于对象上新增的属性无能为力，对于数组则需要拦截它的原型方法来实现响应式。
举个例子：
```js
let vm = new Vue({
  data() {
    return {
        a: 1
    }
  }
})

// ❌  oops，没反应！
vm.b = 2 
```
```js
let vm = new Vue({
  data() {
    return {
        a: 1
    }
  },
  watch: {
    b() {
      console.log('change !!')
    }
  }
})

// ❌  oops，没反应！
vm.b = 2
```
虽然Vue2中提供了一个API：<code>this.$set</code>，来使得新增的属性也拥有响应式的效果。

但是对于很多新手来说，很多时候需要小心翼翼的去判断到底什么情况下需要用 $set，什么时候可以直接触发响应式。

总之，在 Vue3 中，这些都将成为过去。本篇文章会从源码角度帮您理解Vue3响应式的实现原理。

阅读本文之前，请需要先了解[Proxy](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy)和[Reflect](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Reflect)。

## 区别
<code>Proxy</code> 和 <code>Object.defineProperty</code> 的使用方法看似很相似，其实 Proxy 是在 「更高维度」 上去拦截属性的修改的，怎么理解呢？

Vue2 中，对于给定的 data，如 { count: 1 }，是需要根据具体的 **key** 也就是 _count_，去对「修改 data.count 」 和 「读取 data.count」进行拦截，也就是

```js
Object.defineProperty(data, 'count', {
  get() {},
  set() {},
})
```
必须预先知道要拦截的 **key** 是什么，这也就是为什么 Vue2 里对于对象上的新增属性无能为力。

而 Vue3 所使用的 Proxy，则是这样拦截的：

```js
new Proxy(data, {
  get(key) { },
  set(key, value) { },
})
```
可以看到，根本不需要关心具体的 **key**，它去拦截的是 「修改 data 上的任意 key」 和 「读取 data 上的任意 key」。

所以，不管是已有的 key 还是新增的 key，都逃不过它的魔爪。

但是 Proxy 更加强大的地方还在于 Proxy 除了 **get** 和 **set**，还可以拦截更多的操作符。

## 先看个例子
```js
// 简单的响应式数据
const count = ref(0)
// lazy默认为false 这里会执行 输出0
effect(() => console.log(count.value), {lazy: false})
// () => console.log(count.value)再次执行 输出1
count.value++ 
```
**ref**和**effect**是Vue3新出的响应式API，了解更多请移步[Vue3中文文档](https://vue3js.cn/docs/zh/api/reactivity-api.html)

## 从源码逐行分析
[ref.ts](https://github1s.com/vuejs/vue-next/blob/HEAD/packages/reactivity/src/ref.ts) 参考源码，我们可以发现第一行代码 <code>ref(0)</code>, 其实返回的 <code>RefImpl</code> 对象。调用过程 <code>ref</code> => <code>createRef</code> => <code>RefImpl</code>。  
这里贴出包含注释的 <code>RefImpl</code> 源码：
```ts
class RefImpl<T> {
  private _value: T

  public readonly __v_isRef = true

  constructor(private _rawValue: T, public readonly _shallow = false) {
    // convert判断_rawValue是否是对象，如果是对象，将其转化为ReactiveObject
    this._value = _shallow ? _rawValue : convert(_rawValue)
  }
  // 读取value的get方法
  get value() {
    // 开启追踪
    track(toRaw(this), TrackOpTypes.GET, 'value')
    return this._value
  }
  // 设置value的set方法
  set value(newVal) {
    // 判断新旧值是否一样
    if (hasChanged(toRaw(newVal), this._rawValue)) {
      this._rawValue = newVal
      this._value = this._shallow ? newVal : convert(newVal)
      // 触发回调
      trigger(toRaw(this), TriggerOpTypes.SET, 'value', newVal)
    }
  }
}
```  
[effect.ts](https://github1s.com/vuejs/vue-next/blob/HEAD/packages/reactivity/src/effect.ts)  我们先看一下 <code>track</code> 函数都干了啥。
```ts
export function track(target: object, type: TrackOpTypes, key: unknown) {
  // 判断是否应该追踪和activeEffect未定义，activeEffect的值会指向ReactiveEffect。
  if (!shouldTrack || activeEffect === undefined) {
    return
  }
  // targetMap是effect.ts预设的WeakMap对象，主要作用是存储所有追踪的target的deps依赖
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  // 在Ref引用里，key = 'value'
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  if (!dep.has(activeEffect)) {
    // dep添加activeEffect， 也就是reactiveEffect
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
    ...
  }
}
```
<code>track</code> 的逻辑还是比较好理解的，我们需要着重关注下 <code>reactiveEffect</code> 是什么？接下我们来看第二段代码。

```ts
// 注意effect中的回调函数，count.value触发了RefImpl的get方法
effect(() => console.log(count.value), {lazy: false})
```
[effect.ts](https://github1s.com/vuejs/vue-next/blob/HEAD/packages/reactivity/src/effect.ts)  <code>effect</code> 方法的实现非常简单。
```ts
export function effect<T = any>(
  fn: () => T,
  options: ReactiveEffectOptions = EMPTY_OBJ
): ReactiveEffect<T> {
  // 如果参数fn是ReactiveEffect类型，fn重新指向原始函数
  if (isEffect(fn)) {
    fn = fn.raw
  }
  const effect = createReactiveEffect(fn, options)
  // lazy默认为false，这里会默认执行，假如回调函数fn有取值Ref引用的value，从而触发RefImpl的get方法
  if (!options.lazy) {
    effect()
  }
  return effect
}
```
我们继续看一下 <code>createReactiveEffect</code> 的实现。
```ts
function createReactiveEffect<T = any>(
  fn: () => T,
  options: ReactiveEffectOptions
): ReactiveEffect<T> {
  const effect = function reactiveEffect(): unknown {
    // 用于stop的 这里不关心
    if (!effect.active) {
      return options.scheduler ? undefined : fn()
    }
    if (!effectStack.includes(effect)) {
      // 清空effect.deps下已存在的effect
      cleanup(effect)
      try {
        // 开启全局追踪开关
        enableTracking()
        effectStack.push(effect)
        // 注意这里 将effect赋值给effect.ts预设的activeEffect 结合track一起看
        activeEffect = effect
        // effect的回调函数执行，假如回调函数fn有取值Ref引用的value，从而触发RefImpl类get方法下的track追踪 activeEffect会添加进target对应的dep依赖
        return fn()
      } finally {
        effectStack.pop()
        // 重置全局追踪开关
        resetTracking()
        activeEffect = effectStack[effectStack.length - 1]
      }
    }
  } as ReactiveEffect
  effect.id = uid++
  effect.allowRecurse = !!options.allowRecurse
  effect._isEffect = true
  effect.active = true
  effect.raw = fn
  effect.deps = []
  effect.options = options
  return effect
}
```
理解了上述的主要逻辑，我们可以明白为什么 **effect** 都能正确的存储到对应的target deps下了，因为JS是单线程执行的，这是个非常重要的概念。接下来就是如何触发这些 **effect** 了。  
[effect.ts](https://github1s.com/vuejs/vue-next/blob/HEAD/packages/reactivity/src/effect.ts)  我们看一下 <code>RefImpl</code> **set** 方法下的 <code>trigger</code>，源码逻辑有些复杂，我们贴个精简版的。
```ts
// Ref引用的赋值操作，触发trigger方法
export function trigger(
  target: object,
  key?: unknown
) {
  // 获取target对应的depsMap
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
  // 对于Ref引用 key一直是'value' 对于ReactiveObject key不固定
  if (key !== void 0) {
    // 取出已存储的effect 添加进effects
    add(depsMap.get(key))
  }

  const run = (effect: ReactiveEffect) => {
    effect()
  }
  // 遍历执行
  effects.forEach(run)
}
```
这是 <code>trigger</code> 方法的简单实现，主要逻辑还是比较简单的
```ts
// 调用set方法 => 调用trigger => 找出匹配的effect => 遍历执行
count.value++ 
```
以上是Ref引用的简单实现，Ref内部会首先判断响应对象类型，如果响应对象类型是Object，则将其转化为ReactiveObject，也就是调用响应式API <code>reactive</code> 。
<code>reactive</code> 与 <code>ref</code> 的主要区别在于：
* key不一样，ref key值是固定的'value'，reactive不固定。
* reactive实现更加复杂一点，主要用到了Proxy对相关操作实施拦截，ref只有简单set和get。

但是两者大致逻辑还是一样的，在某些操作下开启追踪（track）或触发回调（trigger），理解了ref的实现原理，reactive也就比较好理解了。
这里贴上 <code>reactive</code> 的捕捉器实现源码地址 [基础对象的baseHandlers](https://github1s.com/vuejs/vue-next/blob/HEAD/packages/reactivity/src/baseHandlers.ts) [数组对象的collectionHandlers](https://github1s.com/vuejs/vue-next/blob/HEAD/packages/reactivity/src/collectionHandlers.ts) 以及[Vue3响应式的简单实现](https://github.com/pdslly/vue3-reactive-core.git)

