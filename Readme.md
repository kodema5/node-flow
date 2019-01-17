# node-flow

for defining and running a payload through a function-chain.

## install

* clone this repository
* npm install -g ./node-flow
* node-flow -h

```
Usage: node-flow [options] [url] ...

Options:
  -v, --version        output the version number
  -l, --library [lib]  add library paths (default: [])
  -f, --file [path]    scans file(s) for lines preceded with "> " (default: [])
  -i, --interactive    opens a REPL, .exit to exit (default)
  -h, --help           output usage information

More documentation can be found at https://github.com/kodema5/node-flow/
```

## synopsis (read this first)

```
node-flow is to define and run a payload through a function-chain.
it reuses URL (protocol://host/path?queryString) as

    [cmd|name]://factory/method?[params][&flags]

where:

    [cmd|name]: [lib|new|def|run|end|function_name]
        new://name/Class                creates a new class
        lib://?name|path=               load a library (via libLoader)
        def://name/name,...             combines a set of flow
        run://name,...?payload          runs name in chain
        end://?params                   ends
        name:                           name of definition (use 3+ chars)

    factory: [Class|name]
        Class                           to access static function
        name                            access named instance

    path: builder_|method
        builder_                        calls builder_ that returns a function
        method                          binds to factory method

        when "_" postfixed, it is assume a builder.
        it can be overridden by _type flag

    params: parsed parameters from query-string
        a=1&a=2                         { a: [1, 2] }
        a=1&b=2                         { a: 1, b: 2 }
        a.b=1&a.b=2                     { a: { b: [1, 2] } }

        _* are reserved for flags

    flags:
        _type=method|builder            to override path's type
        _then=name,...                  to be chain executed
        _true=name,...                  to be executed if result is true
        _false=name,...                 to be executed if result is false
        _output=replace|merged|named    on how payload to be passed in chain
                                        default is replace

        when name is 'end', end will be called
```

# example (run this file)

node-flow scans for lines preceded with > (yup it can be a .md file)
    node node-flow.js -f Readme.md

### loading library

> lib://Test?name=./test

can use path=.. or name=... that will be passed to require(..).

when using node-flow standalone,
    the current-directory/node_modules are added module.paths.
    to reference a file,
    use '.' for current directory, alternatively use full path.

### create Class instances

> new://tst1/Test?a=1

creates a new instance Test

> tst2://Test/init_?b=2

usually for async initialization,
calls Test.init_ static function to create a new instance.

### 2. bind functions to a name

> log-value://Test/log_?text=value

usually for utility functions,
binds to static function Test.log_.

> add1://tst1/add_?initial=1

binds methods of tst1 instance

> sub1://tst1/sub_?initial=100

### run chained-functions

> run://add1,log-value?x=1

    value { add:true, x: 2 }

> run://add1,sub1,log-value?x=1&_output=replace

this is the default for the last result

    value { sub:true, x: 98 }

> run://add1,sub1,log-value?x=1&_output=merge

merges the result along the chain

    value { add:true, sub:true, x: 98 }

> run://add1,sub1,log-value?x=1&_output=named

puts the result of a function as named property

    value { sub1: { sub: true, x: 99 }, add1: { add: true, x: 2 }, x: '1' }

### conditional flow

> equ://tst1/equ

> log-no-value://Test/log_?text=not-value

equ returns true if payload .x==.y
to bind to a sync method

> run://add1,equ?x=1&y=2&_output=merge&_true=log-value

    value { x: 2, y: '2', add: true }

> run://add1,equ?x=1&y=3&_output=merge&_true=log-value&_false=log-no-value&_then=log-value

    not-value { x: 2, y: '3', add: true }

### defining a set of named-functions

> def://flow1/add1,equ?x=1&_output=merge&_true=log-value&_false=log-no-value

creates flow1 with to call add1,equ

> run://flow1?y=5

call flow1 with payload

