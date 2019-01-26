#!/usr/bin/env node

const readline = require('readline')
const program = require('commander')
const path = require('path')
const fs = require('fs')
const Flow = require('./Flow')

program
    .version('0.0.1', '-v, --version')
    .usage('[options] [url] ...')
    .option('-l, --library [path]'
        , 'add folder to module paths'
        , (s,m) => m.concat(s.split(','))
        ,[])
    .option('-f, --file [path]'
        , 'loads node-modules as library or execute file.ext!=js'
        , (s,m) => m.concat(s.split(','))
        ,[])
    .option('-i, --interactive'
        , 'opens a REPL, .exit to exit (default)')

    .on('--help', () => {
        console.log('')
        console.log('More documentation can be found at https://github.com/kodema5/node-flow/')
    })
    .parse(process.argv)


program.library.concat('.').forEach((p) => {
    let cd = path.resolve(p.trim())
    if (module.paths.indexOf(cd)>=0) return
    module.paths.push(cd)
    module.paths.push(path.join(cd, './node_modules'))
})

let functions = {
    // run:///log?a=2
    //
    log: (p) => console.log(p),

    // log-x:///log_?prefix=x
    //
    log_: ({prefix}) => ((x) => console.log(prefix, x || '')),

    // sub:///timeout?ms=10&value=y&_call=log-x
    //
    timeout:({ms, value}, callback) => {
        setTimeout(() => callback(value), ms)
    },

    // > print-named-timeout:///log_?prefix=named-timeout
    // > named-timeout://test/timeout_?ms=100&value.a=2&value.b=3&_call=print-named-timeout
    // > run://named-timeout
    //
    timeout_: ({ms,value}, callback) => {
        return async () => {
            setTimeout(() => callback(value), ms)
        }
    },

    // > my-string:///str_?names=name&template=hello ${name}
    // > run://my-string,log?name=world
    //
    str_: ({template,names}) => {
        let a = ['return `' + template + '`']
        if (names) a.unshift('{' + names + '}={}')
        let fn = new Function(...a)
        return (payload) => fn.call(payload, payload)
    },

    // > my-var:///var_?a=12&b=12
    //
    var_: (params) => (payload) => Object.assign({}, params, payload),
}

let library = {}
const flow = new Flow({
    library,
    functions,
    libLoader: loadLibrary,
    onEnd: () => process.exit()
})

function loadLibrary(p) {
    let fn = p.split('/').pop()
    let ext = fn.split('.')[1]

    // load nodejs library
    if (!ext || ext=='js') {
        p = (p[0]==".")
            ? path.join(process.cwd(), p)
            : p
        return require(p)
    }

    // load flow file
    else {
        flow.def.apply(flow, readFile(p))
            .catch(x => console.log(x))
    }
}

function readFile(p) {
    let fn = path.resolve(process.cwd(), p)
    let txt = fs.readFileSync(fn, {encoding: "utf8"})
    return txt.split(/\r?\n/)
        .map(s => s.slice(0,2)=='> ' ? s.slice(2) : '')
        .map(s => s.trim())
        .filter(Boolean)
        .filter(Flow.isURL)
}

program.file.forEach((p) => {
    let a = loadLibrary(p)
    if (!a) return

    let fn = p.split('/').pop()
    let n = fn.split('.')[0]
    library[n] = a
})

flow.def.apply(flow, program.args)
    .catch(x => console.log(x))


if (program.interactive || program.args.length==0 && program.file.length==0) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '> '
    })
    rl.prompt()
    rl.on('line', async (line) => {
        let a = line.trim()
        if (!a) {
            rl.prompt()
            return
        }

        if (a == '.exit') {
            await flow.end()
            process.exit(0)
        }

        else if (a == '.list') {
            console.log('library:')
            Object.keys(flow.library).sort().forEach( (a) => console.log('   ', a))
            console.log('factories:')
            Object.keys(flow.factories).sort().forEach( (a) => console.log('   ', a))
            console.log('functions:')
            Object.keys(flow.functions).sort().forEach( (a) => console.log('   ', a))
        }

        else if (Flow.isURL(a)) {
            await flow.def(a)
        }
        rl.prompt()
    })
}

process.on("SIGINT", async () => {
    await flow.end()
})

process.on("exit", async() => {
    await flow.end()
})