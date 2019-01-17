class Test {

    static timeoutFn(ms, val) {
        return async (p) => {
            return new Promise((done) => setTimeout(() => done(p || val), ms))
        }
    }

    constructor(p) {
        console.log('Test.constructor', p)
        this.cnt = 0
    }

    async add_({initial}) {
        let me = this
        console.log('Test.add_', initial)
        return async ({x}) => {
            return await Test.timeoutFn(1,{
                add: true,
                x: initial + x
            })()
        }
    }

    async sub_({initial}) {
        let me = this
        console.log('Test.sub_', initial)
        return async ({x}) => {
            return await Test.timeoutFn(1,{
                sub: true,
                x: initial - x
            })()
        }
    }

    timeout({ms,value}, callback) {
        console.log('Test.timeout', ms)
        setTimeout(() => callback(value), ms)
    }

    equ({x,y}) {
        console.log('Test.equ', x, y)
        return x==y
    }

    static async init_(p) {
        console.log('Test.init_', p)
        let a = new Test(p)
        return await Test.timeoutFn(1,a)()
    }

    static log(a) {
        console.log(a)
    }

    static log_({text}) {
        return (a) => console.log(text, a)
    }
}

if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = Test
}

