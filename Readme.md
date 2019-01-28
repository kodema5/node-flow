# node-flow

node-flow uses URLs to name and store functions, a parameters/payload is then piped through a sequence of functions (flow)

# install

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

# synopsis

* all are stored in a map as a function
* run is reserved word
* a name is defined by a URL as below

```
    name://[factory[.property]]?[params][.volatile][_flags]

    name can be existing or new-name
    when existing, it will be called

    factory refers to existing name
    Factory, with first uppercase, indicates a Class will be called with new
    factory.builder_, with a postfix_ will be called
    factory.method/property, will be wrapped in a function

    params parsed from from query-string
    a=1&a=2                         { a: [1, 2] }
    a=1&b=2                         { a: 1, b: 2 }
    a.b=1&a.b=2                     { a: { b: [1, 2] } }

    _* are reserved for flags
    .* params will not be passed to next in chain

    _flags will be reserved for flow
    _then=name,...                  to be chain executed next
    _true=name,...                  to be executed if result is true
    _false=name,...                 to be executed if result is false
    _call=name,...                  to be passed as a callback
    _name=name                      to wrap output as { [_name]: output }
    _output=merge|replace|named     on how payload to be passed in chain
                                    (default: merge)

```

**an existing name cant be redefined, as it is already a function and will be called instead**

## named functions

```
    lib(path|name)                      loads various library
    log(payload)                        console.log
    log_({prefix})(payload)             console.log(prefix, payload)
    timeout({ms,value}, _call)          setTimeout(_call(value), ms)
    timeout_({ms,value}, _call)         () => setTimeout(_call(value), ms)
    str_({template,names})              returns a string template
    var_(params)                        returns a merged params and payload
    del({names})                        deletes (/ends) specified names
    END                                 calls end()

```

# usage

## variables and $parameters replacements

> my-var://?a=1

stores parameters as variable

> log://?$my-var&b=2

directly calls log with including stored-variable,
{ b: 2, a: 1 }

> log://?c=$my-var&b=2

calls log with stored-variable as c,
{ c: { a: 1 }, b: 2 }

> my-var//?b=2
\
> log://?$my-var&c=3

**beware redefining my-var (an existing) won't work!** \
my-var is a function that returns { a:1 }.
the above returns { c: 3, a: 1 }

> del://?names=my-var
\
> my-var://?a=2
\
> log://?$my-var

in such, first is to delete my-var, then redefine it if needed. { a: 2 }

## passing payload

> my-var-a://log,log?a=1&.b=2

.params is passed to first in chain only.
{ a: 1, '.': { b: 2 } } is pass to first log,
{.} will be erased, { a: 1 } to the second log.
the last payload is stored in my-var-a

> my-var-b://?b=2
\
> run://my-var-a,my-var-b,log?_output=merge

by default, outputs are merged,
each function can pick-up and add relevant values to payload,
{a:1, b:2}.

> run://my-var-a,my-var-b,log?_output=replace

with 'replace' output, {b:2}

> run://my-var-a,my-var-b,log?_output=named

with 'named' output: { 'my-var-b': { b: 2 }, 'my-var-a': { a: 1 } }

## a builder_ is postfixed with _

> log-hello://log_?prefix=hello
\
> log-hello://?$my-var&text=world

for a function that requires initialization,
log_ is a method with postfixed with _,
returns hello { text: 'world', a: 1 }

## loading, creating and accessing properties of instance of Class

> lib://?path=Readme.js
\
> test://Readme?a=1

creates a new instance of a class


> log://?test_dot_a=!test.a

one can access property directly with "!" prefix { test_dot_a: 1 }

> test-a://test.a?_name=test_a_value
\
> run://test-a,log

_name is provided to wrap a scalar property in payload.
returns { test_a_value: 1 }


> my-result://test.add,log?a=1&b=2
\
> log://?x=$my-result

access a method, perform addition and store to a variable. returns { x: 3 }


## branch _true, _false, _then in flow

>  print-equ://log_?prefix=equal
\
>  print-ne://log_?prefix=not equal
\
>  print-done://log_?prefix=done
\
> is-1://test.is_a_equ_b_?a=1

is-1 compares payload a and b

> is-1://?b=1&_true=print-equ&_false=print-ne&_then=print-done

flow goes to _true then to _then

> is-1://?b=2&_true=print-equ&_false=print-ne&_then=print-done

flow goes to _false then to _then

## passing a _call callback and END

> timeout://?ms=1000&_call=print-done,END

some functions may need a callback _call,
and END terminates function

## for REPL

for testing/development, use -i to enter REPL

````
    node-flow -f Readme.js -i
    > lib://?path=Readme.js
    > test://Readme?a=test
    Test.constructor test
    > inc-a-by-1://test.inc_key_by_?key=a&value=1
    > .list

     END, Readme, inc-a-by-1, lib, log, log_, str_, test, timeout, timeout_, var_

    > run://inc-a-by-1?a=2&_then=log
    { a: 3 }
    > .exit
    --ending test
````
