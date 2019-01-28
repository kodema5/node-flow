class Flow {
    constructor({
        functions = typeof(global) !=='undefined' ? global : window,
        onEnd = () => undefined
    } = {}) {
        let me = this
        me.functions = functions
        me.onEnd = onEnd
    }

    async def(...urls) {
        let me = this
        let args = urls
            .map(u => {
                try { return Flow.parse(u) }
                catch(x) {
                    console.log(x)
                    throw "parse error: " + u
                }
            })
            .filter(Boolean)
        for (const arg of args) {
            await me.build(arg)
        }
    }


    async build({
        name,
        factory,
        params,
        _call,
        _then,
        _true,
        _false,
        _output = 'replace',
        _name
    }) {
        let me = this, lib = me.functions

        // $params replacements
        //
        for (let p in params) {
            let v = params[p]
            if (v=='' && p[0]=='$' && lib[p.slice(1)]) {
                delete params[p]
                Object.assign(params, await lib[p.slice(1)]())
                continue
            }

            if (typeof v == 'string' && v[0]=='$' && lib[v.slice(1)]) {
                params[p] = await lib[v.slice(1)]()
                continue
            }
        }

        // existing://? -- run command
        //
        let isNameExist = name!=='run' && lib.hasOwnProperty(name)
        if (isNameExist) {
            return await me.run({names:name, payload:params, _call, _output, _then, _true, _false, _name})
        }

        // new-name://?params -- saving params as variable
        //
        if (!factory) {
            if (name=='run') throw 'run is a reserved name'
            lib[name] = async () => await params
            return
        }


        // new-name|run://existing,existing,existing -- runs and store value
        //
        let names = factory.split(',')
        names.forEach(me.has.bind(me))
        if (names.length>1) {
            let a =  await me.run({names:factory, payload:params, _call, _output, _then, _true, _false, _name})
            if (name!=='run') {
                lib[name] = async () => await a
            }
            return
        }

        let [cls_name, fn_name] = me.has(factory)
        let cls = lib[cls_name]


        let isClass = cls_name[0].toLowerCase()!=cls_name[0]

        // new-name://Class?a=12  -- creates a new class
        //
        if (isClass && !fn_name) {
            let a = await new cls(params)
            if (name!=='run') {
                lib[name] = a
            }
            return
        }

        // new-name://Class.method
        // new-name://class.method
        // new-name://method_        -- usually builder or an alias
        //
        if (!fn_name) {
            fn_name = cls_name
            cls = lib
        }

        let callback = _call
            ? async (x) => await me.run({names:_call, _output, payload:x})
            : null

        let newFn
        // a property
        if (typeof cls[fn_name] !== 'function') {
            newFn = async () => await cls[fn_name]
        }
        // a builder
        else if (fn_name.slice(-1)=='_') {
            newFn = await cls[fn_name](params, callback)
        }
        // a method
        else {
            newFn = async (payload) => await cls[fn_name](Object.assign({}, params, payload), callback)
        }
        if (!newFn) throw "cant build " + name + " function"

        let Fn = async (payload, cb) => {
            let a = await newFn(payload, cb || callback)

            if (_true && a===true) {
                return await me.run({names:_true, _output, payload })
            }
            else if (_false && a===false) {
                return await me.run({names:_false, _output, payload })
            }

            if (_name) {
                a = { [_name]: a}
            }

            payload = Flow.buildPayload(a, payload, _output, name)
            return await me.run({names:_then, _output, payload})
        }

        if (name!=='run') {
            lib[name] = Fn
        } else {
            Fn(params, callback)
        }
    }

    has(factory) {
        let me = this, lib = me.functions
        let [cls_name, fn_name] = factory.split('.')
        let cls = lib[cls_name]

        if (!cls) throw "unable to find " + cls_name
        if (fn_name && !cls[fn_name]) throw "unable to find " + cls_name + "." + fn_name

        return [cls_name, fn_name]
    }


    async run({names, payload, _call, _output, _then, _true, _false, _name}) {
        let me = this, lib = me.functions
        if (!names) return payload

        let callback = _call
            ? async (x) => await me.run({names:_call, _output, payload:x})
            : null

        for(const name of names.split(',')) {

            let [cls_name, fn_name] = me.has(name)
            let cls = lib[cls_name]

            if (!fn_name) {
                fn_name = cls_name
                cls = lib
            }

            let a
            if (typeof cls[fn_name] !== 'function') {
                a = await cls[fn_name]
            }
            else {
                a = await cls[fn_name](payload, callback)
            }

            // var a = await cls[fn_name](payload, callback)
            if (a==undefined) {
                if (payload) {
                    delete payload['.']
                }
                continue
            }

            if (_true && a===true) {
                a = await me.run({names:_true, _output, payload })
            }
            else if (_false && a===false) {
                a = await me.run({names:_false, _output, payload })
            }

            payload = Flow.buildPayload(a, payload, _output, name)
            payload = await me.run({names:_then, _output, payload})

            if (_name) {
                payload = { [_name]: payload}
            }
        }

        return payload
    }

    async end(params) {
        let me = this, lib = me.functions
        if (me.ended) return
        me.ended = true

        let funcs = Object.values(lib)
            .filter(fn => fn && typeof fn.end == 'function')
            .map(fn => (async () => await fn.end(params))())

        await Promise.all(funcs)

        me.functions = null

        await me.onEnd(params)
    }


    static buildPayload(value, payload = {}, _output='merge', name='') {
        switch(_output) {
            case 'replace':
                payload = value
                break
            case 'named':
                payload = Object.assign({ [name]:value }, payload)
                break
            case 'merge':
            default:
                payload = Object.assign({}, payload, value)
                break
        }

        if (payload) {
            delete payload['.']
        }
        return payload
    }

    static parse(arg) {
        let url = new URL(arg)

        // ensure case
        //
        let n = url.protocol.length
        let name = arg.slice(0, n)
            .match(new RegExp(url.protocol, 'i'))
        name = name && name[0] || ''
        name = name.replace(':', '')

        let factory = arg.substr(n + 2, url.host.length)
            .match(new RegExp(url.host, 'i'))
        factory = factory && factory[0] || ''

        let a = {
            name,
            factory
        }

        // browser URL takes only valid protocols
        //
        if (!a.factory  && url.pathname!=='//') {
            let p = url.pathname
            let h = p.match(/\/\/[\w\.\,-]+/ig)
            h = h && h[0] || ''
            a.factory = h.replace('//', '')
        }

        let params = {}
        for (let a of (new URLSearchParams(url.search).entries())) {

            let ns = a[0].split('.')
            let name = ns.pop()

            var node = params
            ns.forEach((a) => {
                a = a || '.'
                if (!node[a]) node[a] = {}
                node = node[a]
            })

            var v = name[0]!=='_' ? Flow.parseValue(a[1]) : a[1]
            let c = node[name]
            if (!c) {
                node[name] = v
            } else if (Array.isArray(c)) {
                c.push(v)
            } else {
                node[name] = [node[name], v]
            }
        }

        for (const n in params) {
            if (n[0]!=='_') continue
            a[n] = params[n]
            delete params[n]
        }

        a.params = params

        return a
    }

    static parseValue(s) {
        if (s=='') return s
        else if (s=='NaN') return NaN
        else if (!isNaN(s)) return Number(s)
        else if (s=='true') return true
        else if (s=='false') return false
        else if (s=='null') return null
        else if (s=='undefined') return undefined
        return s
    }

    static isURL(txt) {
        try {
            let url = new URL(txt)
            return txt.toLowerCase().indexOf(url.protocol + '//')==0
        } catch(e) {
            return false
        }
    }

}


if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = Flow
}

