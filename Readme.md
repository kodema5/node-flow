# node-flow

node-flow uses URLs to name functions, which then can be sequentially called (a flow)

## install

* clone this repository ```git clone https://github.com/kodema5/node-flow.git```
* install as global ```npm install -g ./node-flow``` then ```node-flow -h```
* or ```node ./node-flow/node-flow.js -h```

```
Usage: node-flow [options] [url] ...

Options:
  -v, --version         output the version number
  -l, --library [path]  add folder to module paths (default: [])
  -f, --file [path]     loads node-modules as library or execute file.ext!=js (default: [])
  -i, --interactive     opens a REPL, .exit to exit (default)
  -h, --help            output usage information

More documentation can be found at https://github.com/kodema5/node-flow/
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
        lib://Name?name|path=           loads library or file
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
        .* params will not be passed to next in chain

    flags:
        _type=method|builder            to override builder's type
        _then=name,...                  to be chain executed next
        _true=name,...                  to be executed if result is true
        _false=name,...                 to be executed if result is false
        _call=name,...                  to be passed as a callback
        _id=name                        to wrap output as { [_id]: output }
        _output=replace|merged|named    on how payload to be passed in chain
                                        (default: replace)
```

# common functions

to be accessed when no factory supplied, ex: run:///log?a=hello-world

    log(payload)                        console.log
    log_({prefix})(payload)             console.log(prefix, payload)
    timeout({ms,value}, _call)          setTimeout(_call(value), ms)
    timeout_({ms,value}, _call)         () => setTimeout(_call(value), ms)
    var_(params)(payload)               returns {} || params || payload
    END                                 calls end()

# usage

node-flow scans for lines preceded with >, to run this file ... (yup it can be a .md file :D)

    node node-flow.js -f Readme.md

---

for loading library, naming functions and creating a function chain

> lib://Test?path=./Readme

load Readme.js named Test, can use path=.. or name=... that will be passed to require(..).

> new://test/Test?a=test

creates a new instance Test named tst1

> new://test2/Test/init_?a=test2

calls a static Test.init_ static function for async initiation

> run:///log?text=hello-world

run log with {text: 'hello-world'}

> print:///log
\
> run://print?text=hello-world

reference log method as print, to be run as below

> print-with-hello:///log_?prefix=hello

log_ is a builder that returns a function

> run://print-with-hello?text=world

the above returns hello {text:'world'}

> run://print,print-with-hello?text=world

runs both of print and print-with-hello

> def://print-all/print,print-with-hello

def, creates an alias

> run://print-all?text=world2

---

subscribing to an event/passing a callback

> print-event:///log_?prefix=an event
\
> sub:///timeout?ms=100&value.a=1&value.b=2&_call=print-event

subscribes to an event with a callback in _call

> print-named-event:///log_?prefix=named-event
\
> named-event:///timeout_?ms=100&value.a=2&value.b=3&_call=print-named-event
\
> run://named-event

registers a named-event with a callback

---

lets take a look on how to branch a flow

>  print-equ:///log_?prefix=equal
\
>  print-ne:///log_?prefix=not equal
\
>  print-done:///log_?prefix=done
\
> is-1://test/is_a_equ_b_?a=1

is-1 compares payload a and b

> run://is-1?b=1&_true=print-equ&_false=print-ne&_then=print-done

flow goes to _true then to _then

> run://is-1?b=2&_true=print-equ&_false=print-ne&_then=print-done

flow goes to _false then to _then

---
params and output to a function.

> my-var:///var_?a=1&b=2
\
> run://my-var,log

var_ accepts params and returns it when called. returns { a:1, b:2 }

> my-var:///var_?a=1&.b=2
\
> run://my-var,log

.params, params started with '.', is to facility function internal parameters,
they passed to function as: { a:1, '.': { b:2 }}.
it will not be passed to next function.
the above returns { a: 1 }

> my-var:///var_?a=1&_id=my
\
> run://my-var,log

_id to facilitate function that returns a raw value to be identified in the payload.
the above returns { my: { a: 1 }}

---

passing payload in the flow.

> print-output:///log_?prefix=payload
\
> inc-a-by-1://test/inc_key_by_?key=a&value=1

returns {a: payload.a + 1}

> inc-b-by-1://test/inc_key_by_?key=b&value=1

returns {b: payload.b + 1}

> run://inc-a-by-1,inc-b-by-1,print-output?a=1&b=1&_output=replace

_output=replace returns the last operation's {b:1}, this is default behavior

> run://inc-a-by-1,inc-b-by-1,print-output?a=1&b=1&_output=merge

_output=merge combines operations' result {a:2, b:2}

> run://inc-a-by-1,inc-b-by-1,print-output?a=1&b=1&_output=named

_output=named adds to payload each results of named function,
{ 'inc-b-by-1': { b: 2 }, 'inc-a-by-1': { a: 2 }, a: 1, b: 1 }

---

ending flow

> print-end:///log_?prefix=end
\
> sub:///timeout?ms=1000&_call=print-end,END

when END is in the flow, all instance's end function (if-exist) will be called,
and program terminates

---

for interactive development (default)

    node-flow -f Readme.js -i
    > lib://Test?path=Readme.js
    > new://test/Test?a=test
    Test.constructor test
    > inc-a-by-1://test/inc_key_by_?key=a&value=1
    > .list
    library:
        Test
    factories:
        test
    functions:
        END
        inc-a-by-1
        log
        log_
        timeout
        timeout_
    > run://inc-a-by-1?a=2&_then=log
    { a: 3 }
    > .exit
    --ending test
