# node-flow

a flow is a sequence of functions names.
node-flow uses URL to declare a function
and pass payload.
it can be a good tool to prototype a workflow.

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
# examples

visit [node-flow-examples](https://github.com/kodema5/node-flow-examples)

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

* std functions

```
    lib(path|name)                      loads various library
    log(payload)                        console.log
    log_({prefix})(payload)             console.log(prefix, payload)
    timeout({ms,value}, _call)          setTimeout(_call(value), ms)
    timeout_({ms,value}, _call)         () => setTimeout(_call(value), ms)
    str_({template,names})              returns a string template
    var_(params)                        returns a merged params and payload
    del({names})                        deletes (/ends) specified names
    equ_(params)                        partial equality with payload
    par({names})                        executes names in parallel
    END                                 calls end()

```

# usage

## variables and $params

```
> var-a://?a=1
  stores {a:1} to var-a

> log://?$var-a&b=2
  combines var-a + {b:2}
{ b: 2, a: 1 }

> log://?c=$var-a&b=2
  combines {c:var-a} + {b:2}
{ c: { a: 1 }, b: 2 }
```

## names are immutable

```
> var-a://?b=2
> log://?$var-a&c=3
  this does not work it!
{c: 3, a: 1}

> del://?names=var-a
  deletes var-a
> var-a://?a=2
  redefines var-a
> log://?$var-a&c=4
{c: 3, a: 2}
```

## declaring a flow

a node in a flow is a function. it can be built with a following pattern

```
> log-a://log?prefix=a
  bind log to params
> log-b://log_?prefix=b
  function has "_" is a builder
> log-c://log_!?prefix=c
  or if "!" is used
```

a flow is just a list of names

```
> log-abc://log-a,log-b,log-c
  defines a sequence
> log-abc://?d=4
  call sequence
{ prefix: 'a', d: 4 }
b { d: 4 }
c { d: 4 }

> run://log-a,log-b,log-c?e=5
  or call it with "run"
{ prefix: 'a', e: 5 }
b { e: 5 }
c { e: 5 }
```

## how payload is passed around

```
> log-ab://log,log?a=1&.b=2
  has the initial { a: 1, '.': { b: 2 } }
  '.' is passed to first log, then erased
> log-ab://?c=2
{ a: 1, '.': { b: 2 }, c: 2 }
{ a: 1, c: 2 }
```

add "!" to save  the flow' output to variable

```
> out-abc://log-ab!?e=5
  add "!" to flow for result
{ a: 1, '.': { b: 2 }, e: 5 }
{ a: 1, e: 5 }
> log://?$out-abc
{ a: 1, e: 5 }
```

### by default payloads are merged

```
> in-a://?a=1
> in-b://?b=2
> run://in-a,in-b,log?c=3&_output=merge
{ c: 3, a: 1, b: 2 }
> run://in-a,in-b,log?c=3&_output=replace
{ b: 2 }
> run://in-a,in-b,log?c=3&_output=named
{ 'in-b': { b: 2 }, 'in-a': { a: 1 }, c: 3 }
```

## branch _true, _false, _then in flow

```
> has-x-1://equ_?x=1
  returns true if x=1 in payload, else false

>  print-equ://log_?prefix=equal
>  print-ne://log_?prefix=not equal
>  print-done://log_?prefix=done

> run://has-x-1?_true=print-equ&_false=print-ne&_then=print-done
not equal {}
done {}
> run://has-x-1?a=1&x=1&_true=print-equ&_false=print-ne&_then=print-done
equal { a: 1, x: 1 }
done { a: 1, x: 1 }
```

<!-- \
    > is-a-1://equ_?a=1

    is-1 compares payload a and b

    > is-a-1://?a=1&_true=print-equ&_false=print-ne&_then=print-done

    flow goes to _true then to _then

    > is-a-1://?a=2&_true=print-equ&_false=print-ne&_then=print-done



    2 }, 'my-var-a': { a: 1 } }

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



    equ_ does a partial equal, returns true/false if specified payload has properties in expected. returns false and true


    >  print-equ://log_?prefix=equal
    \
    >  print-ne://log_?prefix=not equal
    \
    >  print-done://log_?prefix=done
    \
    > is-a-1://equ_?a=1

    is-1 compares payload a and b

    > is-a-1://?a=1&_true=print-equ&_false=print-ne&_then=print-done

    flow goes to _true then to _then

    > is-a-1://?a=2&_true=print-equ&_false=print-ne&_then=print-done

    flow goes to _false then to _then

    ## passing a _call callback and END

    > timeout://?ms=1000&_call=print-done,END

    some functions may need a callback _call,
    and END terminates function

    ## for REPL

    for testing/development, use -i to enter REPL

    ````
        node-flow
        > lib://?path=Readme.js
        > test://Readme?a=test
        Test.constructor test
        > inc-a-by-1://test.inc_key_by_?key=a&value=1
        > .list

        END, Readme, del, equ, equ_, inc-a-by-1, lib, log, log_, str_, test, timeout, timeout_, var_

        > run://inc-a-by-1,log?a=2
        { a: 3 }
        > .exit
        --ending test

    ````
-->
