#!/usr/bin/env node

const readline = require('readline')
const program = require('commander')
const path = require('path')
const fs = require('fs')
const Flow = require('./Flow')

program
    .version('0.0.1', '-v, --version')
    .usage('[options] [url] ...')
    .option('-f, --file [path]'
        , 'loads library or file for lines preceded with "> "'
        , (s,m) => m.concat(s.split(','))
        ,[])

    .option('-i, --interactive'
        , 'opens a REPL, .exit to exit (default)')

    .on('--help', () => {
        console.log('')
        console.log('More documentation can be found at https://github.com/kodema5/node-flow/')
    })
    .parse(process.argv)

let cwd = path.join(process.cwd(), 'node_modules')
if (module.paths.indexOf(cwd)<0) {
    module.paths.unshift(cwd)
}

let library = {}
const flow = new Flow({
    library,
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
            Object.keys(flow.library).sort().forEach( (a) => console.log(' ', a))
            console.log('factories:')
            Object.keys(flow.factories).sort().forEach( (a) => console.log(' ', a))
            console.log('functions:')
            Object.keys(flow.functions).sort().forEach( (a) => console.log(' ', a))
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