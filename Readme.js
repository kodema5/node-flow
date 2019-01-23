class Test {

    static timeoutFn(ms, val) {
        return async (p) => {
            return new Promise((done) => setTimeout(() => done(p || val), ms))
        }
    }

    constructor({a}) {
        console.log('Test.constructor', a)
        this.a = a
    }

    static async init_(p) {
        console.log('Test.init_', p)
        let a = new Test(p)
        return await (Test.timeoutFn(1,a))()
    }

    is_a_equ_b_({a}) {
        return ({b}) => a==b
    }

    async inc_key_by_({key, value}) {
        return (p) => {
            let a = p[key]
            a = isNaN(a) ? 0 : a
            return ({ [key]: value + a})
        }
    }

    end() {
        return console.log('--ending', this.a)
    }
}

if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = Test
}

