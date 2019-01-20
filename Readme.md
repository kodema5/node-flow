# node-flow

node-flow uses URLs to name functions, which then can be sequentially called (a flow)

## install

* clone this repository ```git clone https://github.com/kodema5/node-flow.git```
* install as global ```npm install -g ./node-flow``` then ```node-flow -h```
* or ```node ./node-flow/node-flow.js -h```

```
Usage: node-flow [options] [url] ...

Options:
  -v, --version        output the version number
  -l, --library [lib]  add library paths (default: [])
  -f, --file [path]    scans file(s) for lines preceded with "> " (default: [])
  -i, --interactive    opens a REPL, .exit to exit (default)
  -h, --help           output usage information

```

## url format

```
node-flow reuses URL, protocol://host/path?queryString as

    [name|cmd]://[Class|class]/[builder|method]?[params][&flags]

where:

    [name|cmd]:
        name:                           name of definition (use 3+ chars)
        new://name/Class                creates a new factory
        new://name/Class/method         calls static method for new factory
        lib://Name?name|path=           calls require(name|path)
        def://name/name,...             combines functions into a new name
        run://name,...?payload          runs name in chain
        sub://name/method?_then         subscribe a callback to a method
        end://?params                   calls factory.end with params and exit

    [Class|class]
        Class                           factory class
        class                           factory instance

    [builder_|method]
        builder_                        calls builder_ that returns a function
        method                          binds to factory method

        when "_" postfixed, it is assume a builder_.

    params: parsed parameters from query-string
        a=1&a=2                         { a: [1, 2] }
        a=1&b=2                         { a: 1, b: 2 }
        a.b=1&a.b=2                     { a: { b: [1, 2] } }

        _* are reserved for flags

    flags:
        _type=method|builder            to override builder's type
        _then=name,...                  to be chain executed next
        _true=name,...                  to be executed if result is true
        _false=name,...                 to be executed if result is false
        _output=replace|merged|named    on how payload to be passed in chain
                                        (default: replace)
```

# example

node-flow scans for lines preceded with >, to run this file ... (yup it can be a .md file :D)

    node node-flow.js -f Readme.md

---

for loading library, naming functions and creating a function chain

> lib://Test?path=./test

load test.js named Test, can use path=.. or name=... that will be passed to require(..).

> new://test/Test?a=test

creates a new instance Test named tst1

> new://test2/Test/init_?a=test2

calls a static Test.init_ static function for async initiation

> run://test/log?text=hello-world

run test.log with {text: 'hello-world'}

> print://test/log

> run://print?text=hello-world

reference test.log method as print, to be run as below

> print-with-hello://test/log_?prefix=hello

test.log_ is a builder that returns a function

> run://print-with-hello?text=world

the above returns hello {text:'world'}

> run://print,print-with-hello?text=world

runs both of print and print-with-hello

> def://print-all/print,print-with-hello

def, creates an alias

> run://print-all?text=world2

---

subscribing to an event

> print-event://test/log_?prefix=event

> sub://test/timeout?ms=100&value.a=1&value.b=2&_then=print-event

subscribes to an event with a callback in _then

---

lets take a look on how to branch a flow

>  print-equ://test/log_?prefix=equal

>  print-ne://test/log_?prefix=not equal

>  print-done://test/log_?prefix=done

> is-1://test/is_a_equ_b_?a=1

is-1 compares payload a and b

> run://is-1?b=1&_true=print-equ&_false=print-ne&_then=print-done

flow goes to _true then to _then

> run://is-1?b=2&_true=print-equ&_false=print-ne&_then=print-done

flow goes to _false then to _then

---

passing payload in the flow.

> print-output://test/log_?prefix=payload

> inc-a-by-1://test/inc_key_by_?key=a&value=1

returns {a: payload.a + 1

> inc-b-by-1://test/inc_key_by_?key=b&value=1

returns {b: payload.b + 1}

> run://inc-a-by-1,inc-b-by-1,print-output?a=1&b=1&_output=replace

_output=replace returns the last operation's {b:1}, this is default behavior

> run://inc-a-by-1,inc-b-by-1,print-output?a=1&b=1&_output=merge

_output=merge combines operations' result {a:2, b:2}

> run://inc-a-by-1,inc-b-by-1,print-output?a=1&b=1&_output=named

_output=named adds to payload each results of named function, { 'inc-b-by-1': { b: 2 }, 'inc-a-by-1': { a: 2 }, a: 1, b: 1 }

---

ending flow

> sub://test/timeout?ms=100&_then=END

when END is in the flow, all instance's end function (if-exist) will be called,
and program terminates

---

for interactive development

    node-flow -i
    > lib://Test?path=./test
    > new://test/Test?name=test
    Test.constructor test
    > run://test/log?text=hello node-flow
    { text: 'hello node-flow' }
    > .exit
    --ending test
