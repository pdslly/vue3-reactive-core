
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
'use strict';

var targetMap = new WeakMap();
var effectStack = [];
var activeEffect;
function effect(fn) {
    var effect = createReactiveEffect(fn);
    effect();
    return effect;
}
var uid = 0;
function createReactiveEffect(fn) {
    var effect = function reactiveEffect() {
        if (!effectStack.includes(effect)) {
            cleanup(effect);
            try {
                effectStack.push(effect);
                activeEffect = effect;
                return fn();
            }
            finally {
                effectStack.pop();
                activeEffect = effectStack[effectStack.length - 1];
            }
        }
    };
    effect.id = uid++;
    effect.deps = [];
    return effect;
}
function cleanup(effect) {
    var deps = effect.deps;
    if (deps.length) {
        for (var i = 0; i < deps.length; i++) {
            deps[i].delete(effect);
        }
        deps.length = 0;
    }
}
function track(target, key) {
    if (activeEffect === undefined) {
        return;
    }
    var depsMap = targetMap.get(target);
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map()));
    }
    var dep = depsMap.get(key);
    if (!dep) {
        depsMap.set(key, (dep = new Set()));
    }
    if (!dep.has(activeEffect)) {
        dep.add(activeEffect);
        activeEffect.deps.push(dep);
    }
}
function trigger(target, key) {
    var depsMap = targetMap.get(target);
    if (!depsMap)
        return;
    var effects = new Set();
    var add = function (effectsToAdd) {
        if (effectsToAdd) {
            effectsToAdd.forEach(function (effect) {
                if (effect !== activeEffect) {
                    effects.add(effect);
                }
            });
        }
    };
    if (key !== void 0) {
        add(depsMap.get(key));
    }
    var run = function (effect) {
        effect();
    };
    effects.forEach(run);
}

var hasOwnProperty = Object.prototype.hasOwnProperty;
var hasOwn = function (val, key) { return hasOwnProperty.call(val, key); };
var isArray = Array.isArray;
var isObject = function (val) { return val !== null && typeof val === 'object'; };
var hasChange = function (val, oldVal) { return val !== oldVal && (val === val || oldVal === oldVal); };

var arrayInstrumentations = {};
['push', 'pop', 'shift', 'unshift', 'splice'].forEach(function (key) {
    var method = Array.prototype[key];
    arrayInstrumentations[key] = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var res = method.apply(this, args);
        return res;
    };
});
function createGetter(isReadonly) {
    if (isReadonly === void 0) { isReadonly = false; }
    return function get(target, key, receiver) {
        if (key === "__v_isReactive") {
            return !isReadonly;
        }
        else if (key === "__v_isReadonly") {
            return isReadonly;
        }
        else if (key === "__v_raw" &&
            receiver === (isReadonly ? readonlyMap : reactiveMap).get(target)) {
            return target;
        }
        var targetIsArray = isArray(target);
        if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
            return Reflect.get(arrayInstrumentations, key, receiver);
        }
        var res = Reflect.get(target, key, receiver);
        if (!isReadonly) {
            track(target, key);
        }
        return res;
    };
}
function createSetter(shallow) {
    return function set(target, key, value, receiver) {
        var oldValue = target[key];
        var result = Reflect.set(target, key, value, receiver);
        if (target === toRaw(receiver)) {
            if (hasChange(value, oldValue)) {
                trigger(target, key);
            }
        }
        return result;
    };
}
var get = createGetter();
var set = createSetter();
var mutableHandlers = {
    get: get,
    set: set
};

var ReactiveFlags;
(function (ReactiveFlags) {
    ReactiveFlags["IS_REACTIVE"] = "__v_isReactive";
    ReactiveFlags["IS_READONLY"] = "__v_isReadonly";
    ReactiveFlags["RAW"] = "__v_raw";
})(ReactiveFlags || (ReactiveFlags = {}));
var reactiveMap = new WeakMap();
var readonlyMap = new WeakMap();
function reactive(target) {
    if (target && target["__v_isReadonly"]) {
        return target;
    }
    return createReactiveObject(target, false, mutableHandlers);
}
function createReactiveObject(target, isReadonly, baseHandlers) {
    if (!isObject(target)) {
        {
            console.warn("value cannot be made reactive: " + String(target));
        }
        return target;
    }
    if (target["__v_raw"] &&
        !(isReadonly && target["__v_isReactive"])) {
        return target;
    }
    var proxyMap = isReadonly ? readonlyMap : reactiveMap;
    var existingProxy = proxyMap.get(target);
    if (existingProxy) {
        return existingProxy;
    }
    var proxy = new Proxy(target, baseHandlers);
    proxyMap.set(target, proxy);
    return proxy;
}
function toRaw(observed) {
    return ((observed && toRaw(observed["__v_raw"])) || observed);
}

var convert = function (val) { return isObject(val) ? reactive(val) : val; };
((function () {
    function RefImpl(_rawValue, _shallow) {
        if (_shallow === void 0) { _shallow = false; }
        this._rawValue = _rawValue;
        this._shallow = _shallow;
        this.__v_isRef = true;
        this._value = _shallow ? _rawValue : convert(_rawValue);
    }
    Object.defineProperty(RefImpl.prototype, "value", {
        get: function () {
            track(this, 'value');
            return this._value;
        },
        set: function (newVal) {
            if (hasChange(newVal, this._rawValue)) {
                this._rawValue = newVal;
                this._value = this._shallow ? newVal : convert(newVal);
                trigger(this, 'value');
            }
        },
        enumerable: false,
        configurable: true
    });
    return RefImpl;
})());

var counter = reactive({ count: 0 });
effect(function () { console.log(counter.count); });
counter.count++;
counter.count++;
counter.count++;
