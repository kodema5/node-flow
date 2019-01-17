class Flow {
    constructor({
        factories = {},
        functions = {},
        library = typeof(global) !=='undefined' ? global : window,
        libLoader = () => undefined
    } = {}) {
        let me = this
        me.functions = Object.apply({
            end: async (p) => await me.end(p)
        }, functions)
        me.factories = factories
        me.library = library
        me.libLoader = libLoader
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

        let done = []
        for (const arg of args) {
            let a = await me.build(arg)
            done.push(a)
        }
    }

    async build({
        name,
        factory,
        builder,
        params,
        _type,
        _then,
        _true,
        _false,
        _output = 'replace'
    }) {
        let me = this

        switch(name) {
            // new://name/Class? params
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
                return await me.runFunction({
                    names:factory, payload:params, _output, _then, _true, _false})

            // end://
            //
            case "end":
                return await me.end(params)
        }

        if (!builder) throw "builder is required"

        // name://factory/builder?params
        // factory://name/builder?params
        //
        let cls = me.library[factory] || me.factories[factory]
        if (!cls) throw "factory " + factory + " not found"

        let a = cls[builder]
        if (!a) throw "function " + factory + "." + builder + " not found"

        let buildType = _type
            || (builder.slice(-1)=='_' ? 'builder' : 'method')

        let func
        switch(buildType) {
            case 'builder':
                func = await cls[builder](params)
                break
            case 'method':
                func = async (payload) => await cls[builder](Object.assign(params||{}, payload))
                break
        }
        if (!func) throw "unable to create function for " + _type + " builder type"


        me.functions[name] = async payload => {
            var a = await func(payload)
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

        if (!me.library[builder]) throw "library " + builder + " not found"

        let a = await new me.library[builder](params)
        me.factories[name] = a

        return a
    }

    async runFunction({names, payload={}, _output, _then, _true, _false}) {
        let me = this
        if (!names) return payload

        for(const name of names.split(',')) {
            let fn = me.functions[name]
            if (!fn) throw "function " + name + " not found"

            let a = await fn(payload)
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
        let fns = Object.values(me.factories)
            .map(factory => factory.end)
            .filter(a => typeof a=='function')

        me.functions = {}
        me.factories = {}

        return await Promise.all(fns.map(endFn => endFn(params)))
    }

    static parse(arg) {
        let url = new URL(arg)

        let name = arg.match(new RegExp(url.protocol, 'i'))
        name = name && name[0] || ''
        name = name.replace(':', '')

        let factory = arg.match(new RegExp(url.host, 'i'))
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

            var v = a[1]
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
