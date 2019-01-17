#!/usr/bin/env node

const readline = require('readline')
const program = require('commander')
const path = require('path')
const fs = require('fs')
const Flow = require('./Flow')

program
    .version('0.0.1', '-v, --version')
    .usage('[options] [url] ...')
    .option('-l, --library [lib]'
        , 'add library paths'
        , (s,m) => m.concat(s.split(','))
        , [])

    .option('-f, --file [path]'
        , 'scans file(s) for lines preceded with "> "'
        , (p,m) => {
            let fn = path.resolve(process.cwd(), p)
            let txt = fs.readFileSync(fn, {encoding: "utf8"})
            let ls = txt.split(/\r?\n/)
                .map(s => s.slice(0,2)=='> ' ? s.slice(2) : '')
                .map(s => s.trim())
                .filter(Boolean)
                .filter(Flow.isURL)
            return m.concat(ls)
        }
        ,[])

    .option('-i, --interactive'
        , 'opens a REPL, .exit to exit (default)')

    .on('--help', () => {
        console.log('')
        console.log('More documentation can be found at https://github.com/kodema5/node-flow/')
    })
    .parse(process.argv)

program.args = program.file
    .concat(program.args)


let cwd = path.join(process.cwd(), 'node_modules')
if (module.paths.indexOf(cwd)<0) {
    module.paths.unshift(cwd)
}

function loadLibrary(p) {
    p = (p[0]==".")
        ? path.join(process.cwd(), p)
        : p
    return require(p)
}

let library = program.library
    .reduce( (lib, path) => {
        let name = path.split('/').pop()
        lib[name] = loadLibrary(path)
        return lib
    }, {})

const flow = new Flow({
    library,
    libLoader: loadLibrary,
    onEnd: () => process.exit()
})

flow.def.apply(flow, program.args)
    .catch(x => console.log(x))


if (program.interactive || program.args.length==0) {
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
        else if (Flow.isURL(a)) {
            await flow.def(a)
        }
        rl.prompt()
    })
}

process.on("SIGINT", async () => {
    await flow.end()
    process.exit(0)
})