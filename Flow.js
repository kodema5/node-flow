class Flow {
    constructor({
        factories = {},
        functions = {},
        library = typeof(global) !=='undefined' ? global : window,
        libLoader = () => undefined,
        onEnd = () => undefined
    } = {}) {
        let me = this
        me.library = library
        me.libLoader = libLoader
        me.factories = factories
        me.functions = Object.assign({
            END: async (p) => await me.end(p)
        }, functions)
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
        builder,
        params,
        _type, // builder_|method
        _call,
        _then,
        _true,
        _false,
        _output = 'replace'
    }) {
        let me = this

        switch(name) {
            // new://name/Class? params
            // new://name/Class/method|builder_?params
            //
            case "new":
                return me.newFactory({name:factory, params, builder})

            // lib://name?path|name=
            // lib://?path=
            //
            case "lib":
                let path = params.path || params.name
                if (!path) throw "library path not found"

                for (const p of path.split(',')) {
                    let a = await me.libLoader(p)
                    if (!a) throw "library " + p + " not found"

                    let name = factory || p.split('/').pop()
                    me.library[name] = a
                }
                return

            // def://name/names,..?params
            //
            case "def":
                me.functions[factory] = async (payload) => await me.runFunction({
                    names: builder,
                    payload: Object.assign(params || {}, payload),
                    _output, _then, _true, _false})
                return

            // run://name,..?params
            //
            case "run":
                if (builder) break

                return await me.runFunction({
                    names:factory, payload:params, _output, _then, _true, _false})

            // end://
            //
            case "end":
                return await me.end(params)
        }

        if (!builder) throw "builder is required"

        let cls = me.library[factory] || me.factories[factory]
        if (!cls) throw "factory " + factory + " not found"

        let a = cls[builder]
        if (!a) throw "function " + factory + "." + builder + " not found"

        // sub://factory/method?params&_call
        //
        if (name=='sub') {
            let cb = async (x) => await me.runFunction({names:_call, payload:x})
            return await cls[builder](params, cb)
        }

        // run://factory/method?params
        //
        if (name=='run') {
            let a = await cls[builder](params)
            if (_true && a===true) {
                return await me.runFunction({names:_true, _output, payload:params })
            }
            else if (_false && a===false) {
                return await me.runFunction({names:_false, _output, payload:params })
            }
            params = Flow.buildOutput(a, params, _output, name)
            return await me.runFunction({names:_then, _output, payload:params})
        }

        // name://factory/[builder_|method]?params
        //
        let callback = _call
            ? async (x) => await me.runFunction({names:_call, _output, payload:x})
            : null

        let buildType = _type
            || (builder.slice(-1)=='_' ? 'builder' : 'method')

        let func
        switch(buildType) {
            case 'builder':
                func = await cls[builder](params, callback)
                break
            case 'method':
                func = async (payload) => await cls[builder](Object.assign({}, params, payload), callback)
                break
        }
        if (!func) throw "unable to create function for " + _type + " builder type"

        me.functions[name] = async payload => {

            let a = await func(payload, callback)

            if (_true && a===true) {
                return await me.runFunction({names:_true, _output, payload })
            }
            else if (_false && a===false) {
                return await me.runFunction({names:_false, _output, payload })
            }

            payload = Flow.buildOutput(a, payload, _output, name)
            return await me.runFunction({names:_then, _output, payload})
        }
    }

    static buildOutput(value, payload = {}, _output='replace', name='') {
        switch(_output) {
            case 'named':
                payload = Object.assign({ [name]:value }, payload)
                break
            case 'merge':
                payload = Object.assign({}, payload, value)
                break
            case 'replace':
            default:
                payload = value
                break
        }
        return payload
    }

    async newFactory({name, params, builder}) {
        let me = this
        if (!name) throw "name is required to load a library"

        let [lib, fn]  = builder.split('/')

        let Cls = me.library[lib]
        if (!Cls) throw "library " + lib + " not found"

        if (fn && !Cls[fn]) throw "static function " + lib + "." + fn + " not found"

        let a = await (fn ? Cls[fn](params) : new Cls(params))
        me.factories[name] = a

        return a
    }

    async runFunction({names, payload, _output, _then, _true, _false}) {
        let me = this
        if (!names) return payload

        for(const name of names.split(',')) {
            let func = me.functions[name]
            if (!func) throw "run " + name + " not found"

            var a = await func(payload)
            if (a==undefined) continue

            if (_true && a===true) {
                a = await me.runFunction({names:_true, _output, payload })
            }
            else if (_false && a===false) {
                a = await me.runFunction({names:_false, _output, payload })
            }

            payload = Flow.buildOutput(a, payload, _output, name)
            payload = await me.runFunction({names:_then, _output, payload})
        }

        return payload
    }

    async end(params) {
        let me = this

        let funcs = Object.values(me.factories)
            .filter(factory => factory && typeof factory.end == 'function')
            .map(factory => (async () => await factory.end(params))())

        await Promise.all(funcs)

        // release resources
        me.functions = null
        me.factories = null
        me.library = null

        await me.onEnd(params)
    }

    static parse(arg) {
        let url = new URL(arg)

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
            factory,
            builder: url.pathname
        }

        // browser URL takes only valid protocols
        //
        if (!a.factory  && url.pathname!=='//') {
            let p = url.pathname
            let h = p.match(/\/\/[\w\.\,-]+/ig)
            h = h && h[0] || ''
            a.builder = p.replace(h,'')
            a.factory = h.replace('//', '')
        }

        a.builder = a.builder.replace('/','')

        let params = {}
        for (let a of (new URLSearchParams(url.search).entries())) {

            let ns = a[0].split('.')
            let name = ns.pop()

            var node = params
            ns.forEach((a) => {
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

        let a = Date.parse(s)
        if (!isNaN(a)) return new Date(a)

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
