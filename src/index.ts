import {effect, reactive} from './reactivity'

let counter: Record<'count', number> = reactive({count: 0})

effect(() => {console.log(counter.count)})

counter.count++
counter.count++
counter.count++