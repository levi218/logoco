/**
 * Logo interpreter in ES2017.
 * See `readme.md` for details.
 * 
 * @file logo.js
 * @author Brion Vibber <brion@pobox.com>
 * @license ISC
 */


const reWhitespace = /^[ \t\n\r]$/;
const reNewline = /^[\n\r]$/;
const reDelimiters = /^[-+*\/\[\]()<>]$/;
const reOperators =  /^[-+*\/<>]$/;
const reDigit = /^[0-9]$/;

const precedence = {
    '*': 10,
    '/': 10,
    '+': 5,
    '-': 5,
    '<': 1,
    '>': 1,
    '=': 1,
};

function isNumber(val) {
    return typeof val === 'number';
}

function isString(val) {
    return typeof val === 'string';
}

function isQuoted(val) {
    if (isString(val) && val[0] === '"') {
        return true;
    }
}

function isVariable(val) {
    return isString(val) && val[0] === ':';
}

function isOperator(val) {
    return isString(val) && val.match(reOperators);
}

function isProcedure(val) {
    if (!isString(val)) {
        return false;
    }
    if (isQuoted(val) || isVariable(val)) {
        return false;
    }
    return true;
}

function isBoolean(val) {
    return typeof val === 'boolean';
}

function isWord(val) {
    let type = typeof val;
    return type === 'string' || type === 'number' || type === 'boolean';
}

function isList(val) {
    return val instanceof List;
}

function isLiteral(val) {
    return isList(val) || isBoolean(val) || isNumber(val)
        || isQuoted(val) || isVariable(val);
}



/**
 * Convenience class for creating lists from front to back.
 * Logo code assumes that list tails are immutable, so the
 * dangerous bits are all wrapped up here.
 *
 * Usage:
 *
 * ```js
 * let builder = new ListBuilder();
 * builder.push('an item');
 * return builder.list;
 * ```
 *
 * Accessing the `list` or `end` properties during mutation
 * is dangerous as the results may change from under you.
 */
export class ListBuilder {
    constructor() {
        this.list = List.empty;
        this.end = this.list;
    }

    /**
     * Append a single value onto the end of the list.
     *
     * Named for familiarity with `Array.prototype.push`.
     * Beware of confusion with the Logo stack-manipulation
     * `push` procedure, which inserts at the start.
     *
     * May change the identity of `this.list`.
     * 
     * @param {*} val 
     */
    push(val) {
        if (this.list.isEmpty()) {
            this.list = new List(val);
            this.end = this.list;
        } else {
            this.end = this.end.tail = new List(val);
        }
    }

    /**
     * Concatenate items from an iterable source
     * onto the end of the list.
     *
     * May change the identity of `this.list`.
     *
     * @param {Iterable} iterable 
     */
    concat(iterable) {
        for (let val of iterable) {
            this.push(val);
        }
    }

    /**
     * Attach an existing list on the tail.
     * Beware this can modify the tail, so only
     * use this if you're being clever.
     *
     * Takes ownership of `list`.
     * May change the identity of `this.list`.
     *
     * @param {List} list 
     */
    attach(list) {
        if (this.list.isEmpty()) {
            this.list = list;
        } else {
            this.end.tail = list;
        }
        this.end = list.end();
    }
}

/**
 * Linked list record -- the core of any good LISP!
 *
 * `List` objects are iterable from JavaScript for
 * convenience, so may be used in `for`-`of` loops
 * or converted to arrays with `Array.from`.
 *
 * You may also create a `List` from any JavaScript
 * iterable such as array with `List.from`.
 *
 * JavaScript code can change the `head` values and
 * `tail` pointers, but this is dangerous as it may
 * break invariant assumptions. Use the `ListBuilder`
 * convenience class for front-to-back construction
 * operations.
 *
 * The tail pointer will always point to a list, but
 * may be the empty list. This means that the empty
 * list has a circular tail reference to itself,
 * so beware.
 */
export class List {
    /**
     * Create a new linked-list record.
     *
     * @param {LogoValue} head
     * @param {List} [tail=List.empty]
     */
    constructor(head, tail=List.empty) {
        if (head === undefined) {
            if (List.empty) {
                throw new TypeError('Only one empty list may be created');
            }
            this.head = undefined;
            this.tail = this;
        } else {
            this.head = head;
            this.tail = tail;
        }
    }

    /**
     * @returns {boolean}
     */
    isEmpty() {
        return this.head === undefined;
    }

    /**
     * @returns {boolean}
     */
    hasTail() {
        return !this.tail.isEmpty();
    }

    /**
     * Create an iterator object using the given callback
     * to control the value returned.
     * @param {function} callback - filters the List record cursors into the iterator data values
     * @returns {Generator}
     */
    *iterator(callback) {
        let cursor = this;
        while (!cursor.isEmpty()) {
            // invariant: cursor is always non-empty
            yield callback(cursor);
            cursor = cursor.tail;
        }
    }

    /**
     * Return an iterable over the List record cursors
     * @returns {Generator}
     */
    cursors() {
        return {
            [Symbol.iterator]: () => {
                return this.iterator((cursor) => cursor);
            }
        }
    }

    /**
     * Return an iterator over the contained items
     * @returns {Generator}
     */
    [Symbol.iterator]() {
        return this.iterator((cursor) => cursor.head);
    }

    reverse() {
        // Using tail recursion
        let reverseList = (list, rest) => {
            if (list.isEmpty()) {
                return rest;
            }
            if (!list.hasTail()) {
                return new List(list.head, rest);
            }
            return reverseList(list.tail,
                new List(list.head, rest));
        };
        return reverseList(this, List.empty);
    }

    /**
     * Create a new list using a filter function
     * @param {function} callback 
     */
    filter(callback, thisArg=this) {
        let builder = new ListBuilder();
        for (let cursor of this.cursors()) {
            if (callback.call(thisArg, cursor.head, cursor, this)) {
                builder.push(cursor.head);
            }
        }
        return builder.list;
    }

    /**
     * Create a new list using a mapping function
     * @param {function} callback 
     */
    map(callback, thisArg=this) {
        let builder = new ListBuilder();
        for (let cursor of this.cursors()) {
            let val = callback.call(thisArg, cursor.head, cursor, this);
            builder.push(val);
        }
        return builder.list;
    }

    count() {
        let n = 0;
        for (let _item of this) {
            n++;
        }
        return n;
    }

    // Return the List record at the end
    // if list is empty, will return this
    // invariant: return value has empty tail
    end() {
        let end = this;
        for (let cursor of this.cursors()) {
            end = cursor;
        }
        return end;
    }

    static equal(a, b) {
        if (a === b) {
            return true;
        }
        if (!isList(a) || !isList(b)) {
            return false;
        }
        if (!List.equal(a.head, b.head)) {
            return false;
        }
        return List.equal(a.tail, b.tail);
    }

    /**
     * Create a List from another list, JS array, or other iterable.
     *
     * @param {Iterable} source
     */
    static from(source) {
        let builder = new ListBuilder();
        builder.concat(source);
        return builder.list;
    }

    /**
     * Create a List from the given JS arguments.
     *
     * @param  {...any} args
     */
    static of(...args) {
        return List.from(args);
    }

    /**
     * Create a new List that's a copy of this one.
     */
    clone() {
        return List.from(this);
    }

    static stringify(val, delimiters = ['[', ']'], stack=[]) {
        if (isList(val)) {
            // Avoid recursive list references
            if (stack.includes(val)) {
                return '<recursive>';
            }
            stack.push(val);
            let first = true;
            let str = delimiters[0];
            for (let item of val) {
                if (first) {
                    first = false;
                } else {
                    str += ' ';
                }
                str += List.stringify(item, delimiters, stack);
            }
            str += delimiters[1];
            stack.pop();
            return str;
        }
        return String(val);
    }

    toString() {
        return List.stringify(this);
    }
}

List.empty = new List();

/**
 * Wrapper for variable bindings.
 */
export class Binding {
    /**
     * Create a new binding, with an initial value.
     * @param {LogoVal} [val]
     */
    constructor(val) {
        this.value = val;
    }
}

/**
 * Represents an execution context / activation record / stack frame.
 * A procedure call gets one, but blocks and templates executed on
 * its behalf will reuse the same one.
 *
 * For instance the inner `output`s here return from the procedure,
 * not just the `if` blocks:
 *
 * ```logo
 * to is_big :n
 *   if :n > 1000 [output true]
 *   if :n < 1000 [output false]
 *   print [just right]
 *   output false
 * end
 * ```
 */
export class Context {
    constructor() {
        this.output = undefined;
        this.stop = false;
    }
}

export class Scope {
    /**
     * Create a new variable scope with the given parent.
     *
     * @param {Scope} ?parent
     */
    constructor(parent) {
        this.parent = parent;

        // Use the prototype chain to aid lookups
        this.bindings = Object.create(parent ? parent.bindings : null);
    }

    /**
     * Look up a variable binding and return its value.
     *
     * @param {string} name - variable name to look up
     * @returns {LogoVal} - the bound value
     * @throws {ReferenceError} if not found in current or parent scopes
     */
    get(name) {
        let binding = this.getBinding(name);
        if (binding) {
            return binding.value;
        } else {
            throw new ReferenceError("Undeclared variable " + name);
        }
    }

    set(name, val) {
        let binding = this.getBinding(name);
        if (binding) {
            binding.value = val;
        } else {
            // Unbound vars should jump to global scope.
            let scope = this;
            while (scope.parent) {
                scope = scope.parent;
            }
            scope.bindValue(name, val);
        }
    }

    /**
     * Get the Binding for a given variable in the current or
     * parent scopes.
     *
     * @param {string} name - variable name to look up
     * @returns {Binding|undefined}
     */
    getBinding(name) {
        return this.bindings[name];
    }

    /**
     * Apply given binding to the given variable name in the
     * current scope. Will shadow any parent scope bindings, or
     * replace a binding in current scope.
     *
     * @param {string} name 
     * @param {Binding} binding
     */
    bind(name, binding) {
        this.bindings[name] = binding;
    }

    /**
     * Create a new binding for the given variable name in the
     * current scope. Will shadow any parent scope bindings, or
     * replace a binding in current scope.
     * 
     * Initialize it with the given value.
     *
     * @param {string} name 
     * @param {Binding} binding
     */
    bindValue(name, val) {
        this.bind(name, new Binding(val));
    }

    /**
     * Create multiple bindings
     * @param {object} map - own properties are bound as variables
     */
    bindValues(map) {
        for (let item of Object.keys(map)) {
            this.bindValue(item, map[item]);
        }
    }
}

// Helpers for builtins

async function doMap(data, template, rest, callback) {
    let sources = [data];
    while (rest.length) {
        sources.push(template);
        template = rest.shift();
    }
    let iters = sources.map((source) => {
        return source[Symbol.iterator]()
    });
    for (;;) {
        let allDone = true;
        let anyDone = false;
        let args = iters.map((iter) => {
            let {done, value} = iter.next();
            anyDone = anyDone || done;
            allDone = allDone && done;
            return value;
        });
        if (anyDone) {
            break;
        }
        let val = await this.runTemplate(template, args);
        if (callback) {
            callback(val);
        }
    }
}

function unaryMinus(a) {
    return -a;
}

// Builtin procedures
let builtins = {
    // Logical operations
    true: async function() {
        return true;
    },
    false: async function() {
        return false;
    },
    and: async function(a, b, ...rest) {
        // UCBLogo extends this to support instruction
        // lists with lazy evaluation. Consider this.
        if (!a) {
            return false;
        }
        if (!b) {
            return false;
        }
        for (let item of rest) {
            if (!item) {
                return false;
            }
        }
        return true;
    },
    or: async function(a, b, ...rest) {
        // UCBLogo extends this to support instruction
        // lists with lazy evaluation. Consider this.
        if (a) {
            return true;
        }
        if (b) {
            return true;
        }
        for (let item of rest) {
            if (item) {
                return true;
            }
        }
        return false;
    },
    not: async function(a) {
        return !a;
    },

    // Lists and words
    word: async function(a, b, ...rest) {
        let args = [a, b].concat(rest);
        for (let arg of args) {
            if (!isWord(arg)) {
                throw new TypeError('args must be words');
            }
        }
        return args.join('');
    },
    se: async function(a, b, ...rest) {
        let args = [a, b].concat(rest);
        let builder = new ListBuilder();
        for (let arg of args) {
            if (isList(arg)) {
                for (let item of arg) {
                    builder.push(item);
                }
            } else {
                builder.push(arg);
            }
        }
        return builder.list;
    },
    list: async function(a, b, ...rest) {
        return new List(a, new List(b, List.from(rest)));
    },
    fput: async function(thing, list) {
        if (!isList(list)) {
            throw new TypeError('list must be a list');
        }
        // uses existing list as tail, fast!
        return new List(thing, list);
    },
    lput: async function(thing, list) {
        if (!isList(list)) {
            throw new TypeError('list must be a list');
        }
        // copies list, inefficient!
        let builder = new ListBuilder();
        builder.concat(list);
        builder.push(thing);
        return builder.list;
    },
    combine: async function(a, b) {
        if (isString(b)) {
            return await builtins.word.call(this, a, b);
        }
        if (isList(b)) {
            return await builtins.fput.call(this, a, b);
        }
        throw new TypeError('second arg must be string or list');
    },
    reverse: async function(list) {
        if (isList(list)) {
            return list.reverse();
        }
        throw new TypeError('list must be a list');
    },
    count: async function(arg) {
        if (isList(arg)) {
            return arg.count();
        }
        if (isString(arg)) {
            return arg.length;
        }
        throw new TypeError('arg must be a word or list');
    },
    first: async function(arg) {
        if (isString(arg)) {
            if (arg === '') {
                throw new TypeError('empty string');
            }
            return arg[0];
        }
        if (isList(arg)) {
            if (arg.isEmpty()) {
                throw new TypeError('empty list');
            }
            return arg.head;
        }
        throw new TypeError('must be a string or list');
    },
    last: async function(arg) {
        if (isString(arg)) {
            if (arg === '') {
                throw new TypeError('empty string');
            }
            return arg[arg.length - 1];
        }
        if (isList(arg)) {
            if (arg.isEmpty()) {
                throw new TypeError('empty list');
            }
            let end = arg.end();
            return end.head;
        }
        throw new TypeError('must be a string or list');
    },
    butfirst: async function(arg) {
        if (isString(arg)) {
            if (arg === '') {
                throw new TypeError('empty string');
            }
            return arg.substr(1);
        }
        if (isList(arg)) {
            if (arg.isEmpty()) {
                throw new TypeError('empty list');
            } else {
                // Fast split of immutable list tail!
                return arg.tail;
            }
        }
        throw new TypeError('must be a string or list');
    },
    butlast: async function(arg) {
        if (isString(arg)) {
            if (arg === '') {
                throw new TypeError('empty string');
            }
            return arg.substr(0, -1);
        }
        if (isList(arg)) {
            if (arg.isEmpty()) {
                throw new TypeError('empty list');
            }
            return arg.filter((_item, cursor) => {
                // Exclude the final cursor record
                return cursor.hasTail();
            });
        }
        throw new TypeError('butlast requires a list or string');
    },
    item: async function(index, thing) {
        if (!isNumber(index)) {
            throw new TypeError('index must be a number');
        }
        if (index < 0) {
            throw new TypeError('index must be non-negative');
        }
        if (index !== (index | 0)) {
            throw new TypeError('index must be an integer');
        }
        if (isString(thing)) {
            if (index > thing.length) {
                throw new TypeError('index is beyond string length');
            }
            return thing[index];
        }
        if (isList(thing)) {
            let n = 1;
            for (let item of thing) {
                if (n === index) {
                    return item;
                }
                ++n;
            }
            throw new TypeError('index is beyond list length');
        }
        throw new TypeError('Expected list');
    },
    remove: async function(thing, list) {
        return list.filter((item) => {
            return (thing !== item);
        });
    },

    // Output

    print: async function(arg1, ...args) {
        args.unshift(arg1);
        let msg = args.map((arg) => {
            return List.stringify(arg, ['', '']);
        }).join(' ');
        await this.print(msg);
    },

    show: async function(arg1, ...args) {
        args.unshift(arg1);
        let msg = args.map((arg) => {
            return List.stringify(arg, ['[', ']']);
        }).join(' ');
        await this.print(msg);
    },

    wait: function(frames) {
        return new Promise((resolve, reject) => {
            let ms = (1000 * frames) / 60;
            let id = setTimeout(() => {
                this.onbreak = null;
                resolve();
            }, ms);
            this.onbreak = (reason) => {
                clearTimeout(id);
                reject(reason);
            };
        });
    },

    // Value get/set

    thing: async function(name) {
        if (!isString(name)) {
            throw new TypeError('Invalid variable name');
        }
        let binding = this.currentScope().getBinding(name);
        if (!binding) {
            throw new ReferenceError('Undefined variable ' + name);
        }
        return binding.value;
    },
    make: async function(name, val) {
        if (!isString(name)) {
            throw new TypeError('Invalid variable name');
        }
        this.currentScope().set(name, val);
    },
    local: async function(name, ...names) {
        let all;
        if (isList(name)) {
            all = Array.from(name);
        } else {
            all = [name];
        }
        for (let n of names) {
            all.push(n);
        }
        for (let n of all) {
            if (!isString(n)) {
                throw new TypeError('Invalid variable name');
            }
            let binding = new Binding();
            this.currentScope().bind(n, binding);
        }
    },
    global: async function(name, ...names) {
        let all;
        if (isList(name)) {
            all = Array.from(name);
        } else {
            all = [name];
        }
        for (let n of names) {
            all.push(n);
        }
        for (let n of all) {
            if (!isString(n)) {
                throw new TypeError('Invalid variable name');
            }
            let binding = this.globalScope.getBinding(n);
            if (!binding) {
                binding = new Binding();
                this.globalScope.bind(n, binding);
            }
            this.currentScope().bind(n, binding);
        }
    },
    push: async function(name, val) {
        let scope = this.currentScope();
        let list = scope.get(name);
        if (!isList(list)) {
            throw new TypeError(name + ' is not a list');
        }
        list = new List(val, list);
        scope.set(list);
    },

    // Infix operators
    '+': async function(a, b) {
        return a + b;
    },
    '-': async function(a, b) {
        return a - b;
    },
    '*': async function(a, b) {
        return a * b;
    },
    '/': async function(a, b) {
        return a / b;
    },
    '<': async function(a, b) {
        return a < b;
    },
    '>': async function(a, b) {
        return a > b;
    },
    '=': async function(a, b) {
        return List.equal(a, b);
    },

    // Arithmetric
    sum: async function(a, b) {
        return a + b;
    },
    difference: async function(a, b) {
        return a - b;
    },
    product: async function(a, b) {
        return a * b;
    },
    quotient: async function(a, b) {
        return a / b;
    },
    remainder: async function(a, b) {
        return a % b;
    },

    // Predicates
    emptyp: async function(arg) {
        if (isList(arg)) {
            return arg.isEmpty();
        }
        if (isString(arg)) {
            return arg === '';
        }
        return false;
    },
    equalp: async function(a, b) {
        return List.equal(a, b);
    },
    listp: async function(arg) {
        return isList(arg);
    },
    memberp: async function(arg, list) {
        if (!isList(list)) {
            throw new TypeError('list must be a list');
        }
        for (let item in list) {
            if (List.equal(arg, item)) {
                return true;
            }
        }
        return false;
    },
    numberp: async function(arg) {
        return isNumber(arg);
    },
    wordp: async function(arg) {
        // Note in Atari Logo at least, words include numbers and booleans
        return isWord(arg);
    },

    // Control structures
    stop: async function() {
        let context = this.currentContext();
        if (context === this.globalContext) {
            throw new SyntaxError('stop is not allowed at top level');
        }
        context.stop = true;
    },
    output: async function(arg) {
        let context = this.currentContext();
        if (context === this.globalContext) {
            throw new SyntaxError('output is not allowed at top level');
        }
        context.stop = true;
        context.output = arg;
    },
    run: async function(block) {
        if (!isList(block)) {
            throw new TypeError('block must be a list');
        }
        return await this.evaluate(block);
    },
    runresult: async function(block) {
        if (!isList(block)) {
            throw new TypeError('block must be a list');
        }
        let result = await this.evaluate(block);
        if (result === undefined) {
            return List.empty;
        }
        return List.of(result);
    },
    repeat: async function(times, block) {
        if (!isNumber(times)) {
            throw new TypeError('times must be a number');
        }
        if (!isList(block)) {
            throw new TypeError('block must be a list');
        }
        for (let i = 0; i < times; i++) {
            await this.evaluate(block);
            if (this.currentContext().stop) {
                break;
            }
        }
    },
    forever: async function(block) {
        for (;;) {
            await this.evaluate(block);
            if (this.currentContext().stop) {
                break;
            }
        }
    },
    if: async function(cond, block) {
        if (cond) {
            return await this.evaluate(block);
        }
    },
    ifelse: async function(cond, thenBlock, elseBlock) {
        if (cond) {
            return await this.evaluate(block);
        } else {
            return await this.evaluate(block);
        }
    },

    // Template iteration
    apply: async function(template, inputlist) {
        let inputs = Array.from(inputlist);
        return await this.runTemplate(template, inputs);
    },
    invoke: async function(template, input1, ...inputs) {
        inputs.unshift(input1);
        return await this.runTemplate(template, inputs);
    },
    foreach: async function(data, template, ...rest) {
        await doMap.call(this, data, template, rest);
    },
    map: async function(data, template, ...rest) {
        let builder = new ListBuilder();
        await doMap.call(this, data, template, rest, (val) => {
            builder.push(val);
        });
        return builder.list;
    },
};

// Aliases of builtin procedures and macros
let aliases = {
    'op': 'output',
    'bf': 'butfirst',
    'bl': 'butlast',
};
for (let [alias, original] of Object.entries(aliases)) {
    builtins[alias] = builtins[original];
}

export class Interpreter {
    constructor() {
        // procedurs
        this.procedureScope = new Scope();
        this.procedureScope.bindValues(builtins);
        // variables
        this.globalScope = new Scope();
        // top-level context
        this.globalContext = new Context();

        // stack
        this.scopes = [this.globalScope];
        this.contexts = [this.globalContext];

        // keeps track of original source position of parsed list nodes
        this.sourceMap = new WeakMap();

        // Set to true during program execution.
        this.running = false;
        // Set to true when break() is called.
        this.breakFlag = false;
        // Set to true when pause() is called.
        this.paused = false;

        // Sync callback for cancelable async operations
        // exposed through commands.
        this.onbreak = null;
        this.oncontinue = null;

        // Async callback for Logo code evaluation.
        // Is called with the body, current node, and
        // argument values on every command or operation
        // call.
        //
        // Code can trace, or even delay execution.
        this.oncall = null;
        this.onvalue = null;
        this.onprint = null;
    }

    currentContext() {
        let contexts = this.contexts;
        let len = contexts.length;
        if (len > 0) {
            return contexts[len - 1];
        }
        return undefined;
    }

    currentScope() {
        let scopes = this.scopes;
        let len = scopes.length;
        if (len > 0) {
            return scopes[len - 1];
        }
        return undefined;
    }

    async print(str) {
        str = String(str);
        if (this.onprint) {
            await this.onprint(str);
        } else {
            this.console.log(str);
        }
    }

    /**
     * Create a live function object wrapping a Logo
     * procedure definition.
     *
     * @param {string} funcName 
     * @param {Iterable<string>} argNames 
     * @param {Iterable<LogoValue>} body 
     * @returns {function}
     */
    procedure(funcName, argNames, body) {
        if (!isString(funcName)) {
            throw new TypeError('function name must be a string');
        }
        for (let name of argNames) {
            if (!isString(name)) {
                throw new TypeError('function argument names must be strings');
            }
        }
        let func = async (...args) => {
            // Locally bind the arguments
            let parentScope = this.currentScope();
            let scope = new Scope(parentScope);
            for (let [index, name] of argNames.entries()) {
                scope.bindValue(name, args[index]);
            }
            let context = new Context();
            this.scopes.push(scope);
            this.contexts.push(context);
            try {
                await this.evaluate(body);
            } finally {
                this.contexts.pop();
                this.scopes.pop();
            }
            return context.output;
        };
        Object.defineProperties(func, {
            length: {
                value: argNames.length,
                writable: false,
                enumerable: false,
                configurable: true,
            },
            name: {
                value: funcName,
                writable: false,
                enumerable: false,
                configurable: true,
            },
        });
        return func;
    }

    sourceForNode(listNode) {
        return this.sourceMap.get(listNode);
    }

    parse(source) {
        let parsed = new ListBuilder();
        let stack = [];
        let start = 0;
        let end = 0;

        let push = () => {
            stack.push([parsed, start]);
            parsed = new ListBuilder();
        };

        let pop = () => {
            let sublist = parsed.list;
            [parsed, start] = stack.pop();
            return sublist;
        };

        let prev = () => {
            return source.charAt(end - 1);
        };
        let peek = () => {
            return source.charAt(end);
        };

        let consume = () => {
            end++;
        };

        let record = (val) => {
            parsed.push(val);
            this.sourceMap.set(parsed.end, {
                source: source,
                start: start,
                end: end,
            });
            start = end;
        };

        let discard = () => {
            start = end;
        };

        let parseComment = () => {
            consume(); // skip the ";"
            for(;;) {
                let char = peek();
                consume();
                if (!char || char.match(reNewline)) {
                    discard();
                    return;
                }
            }
        };

        let parseList = () => {
            consume(); // skip the "["
            push();
            for(;;) {
                let char = peek();
                if (!char) {
                    throw new SyntaxError("End of input in list");
                }
                if (char === ']') {
                    consume();
                    record(pop());
                    return;
                }
                parseMain();
            }
        };

        let parseNumber = () => {
            let last = prev();
            let char = peek();
            // invariant: char is '-' or a digit
            let token = char;
            consume();

            // Unary minus escape
            if (token === '-') {
                let next = peek();
                if (!(last === '' || last.match(reWhitespace)) || !next.match(reDigit)) {
                    record(token);
                    return;
                }
            }

            // integer part
            for (;;) {
                let char = peek();
                if (char.match(reDigit)) {
                    token += char;
                    consume();
                    continue;
                }
                // @fixme check about \ in numbers?
                break;
            }
            // fractional part?
            char = peek();
            if (char === '.') {
                consume();
                token += char;

                char = peek();
                if (!char.match(reDigit)) {
                    throw new SyntaxError('Expected decimals');
                }
                token += char;
                consume();

                for (;;) {
                    char = peek();
                    if (char.match(reDigit)) {
                        token += char;
                        consume();
                        continue;
                    }
                    break;
                }
            }
            char = peek();
            if (char === 'e') {
                // Exponent part
                token += char;
                consume();

                char = peek();
                if (char === '-' || char === '+') {
                    token += char;
                    consume();
                }
                for (;;) {
                    char = peek();
                    if (char.match(reDigit)) {
                        token += char;
                        consume();
                        continue;
                    }
                    break;
                }
            }

            char = peek();
            if (!char || char.match(reDelimiters) || char.match(reWhitespace)) {
                record(parseFloat(token));
                return;
            }
        };

        let parseWord = () => {
            let token = '';
            for (;;) {
                let char = peek();
                if (!char || char.match(reWhitespace)) {
                    record(token);
                    return;
                }
                if (char.match(reDelimiters)) {
                    if (token === '"') {
                        if (char !== '[' && char !== ']') {
                            // First quoted delimiter char doesn't have to be escaped
                            // unless it's a bracket.
                            token += char;
                            consume();
                            continue;
                        }
                    }
                    record(token);
                    return;
                }
                if (char.match(reWhitespace)) {
                    record(token);
                    return;
                }
                if (char === '\\') {
                    consume();
                    if (!char) {
                        throw new SyntaxError('End of input at backslash');
                    }
                    char = peek();
                    token += char;
                    consume();
                    continue;
                }
                token += char;
                consume();
            }
        };

        let parseMain = () => {
            let char = peek();
            if (!char) {
                throw new SyntaxError('End of input');
            }
            if (char === ';') {
                parseComment();
                return;
            }
            if (char === '[') {
                parseList();
                return;
            }
            if (char.match(reWhitespace)) {
                consume();
                discard();
                return;
            }
            if (char.match(reNewline)) {
                // @fixme should there be differences?
                consume();
                discard();
                return;
            }
            if (char === '-' || char.match(reDigit)) {
                parseNumber();
                return;
            }
            if (char === '(' || char === ')') {
                // @fixme count parens?
                consume();
                record(char);
                return;
            }
            if (char.match(reOperators)) {
                consume();
                record(char);
                return;
            }
            parseWord();
        };

        for (;;) {
            let char = peek();
            if (!char) {
                // Done!
                return parsed.list;
            }
            parseMain();
        }
    }

    /**
     * Check the break flag and perform a procedure call.
     * This operation will be observable asynchronously
     * sometime in the future.
     *
     * @param {function} func 
     * @param {array} args 
     */
    async performCall(func, args, body=undefined, node=undefined) {
        await this.checkBreak();
        if (this.oncall) {
            await this.oncall(func, args, body, node);
        }
        let retval = await func.apply(this, args);
        if (retval !== undefined && this.onvalue) {
            await this.onvalue(retval, body, node);
        }
        return retval;
    }

    async runTemplate(template, args) {
        if (isString(template)) {
            // word -> command
            let binding = this.procedureScope.getBinding(template);
            if (!binding) {
                throw new ReferenceError('Unbound template command ' + template);
            }
            let func = binding.value;
            return await this.performCall(func, args);
        }

        if (!isList(template)) {
            throw new TypeError('Template must be command or list');
        }
        if (template.isEmpty()) {
            return undefined;
        }

        let scope = new Scope(this.currentScope());
        if (isList(template.head)) {
            // arg names
            let names = template.head;
            template = template.tail;
            let n = 0;
            for (let name of names) {
                if (n > args.length) {
                    throw new ReferenceError('Not enough arguments given to template');
                }
                scope.bindValue(name, args[n]);
                ++n;
            }
        } else {
            // no arg names
            throw new TypeError('Template must have arguments');
            // todo: question-mark form?
        }
        // todo: 'procedure text form'?

        this.scopes.push(scope);
        try {
            return await this.evaluate(template);
        } finally {
            this.scopes.pop();
        }
    }

    async evaluate(body) {
        let interpreter = this;
        let scope = this.currentScope();
        let context = this.currentContext();
        let iter = body;

        function validateCommand(command, binary=false) {
            // hack for unary minus
            if (!binary && command === '-') {
                return unaryMinus;
            }

            if (!isString(command)) {
                throw new SyntaxError('Invalid command word: ' + command);
            }

            let binding = interpreter.procedureScope.getBinding(command);
            if (!binding) {
                throw new TypeError('Unbound function: ' + command);
            }

            let func = binding.value;
            return func;
        }

        async function handleLiteral() {
            let node = iter;
            let value = iter.head;
            iter = iter.tail;
            if (isList(value) || isBoolean(value) || isNumber(value)) {
                if (interpreter.onvalue) {
                    await interpreter.onvalue(value, body, node);
                }
                return value;
            }
            if (!isString(value)) {
                throw new SyntaxError('Unexpected token ' + value);
            }
            let first = value[0];
            let rest = value.substr(1);
            if (first === '"') {
                // String literal
                if (interpreter.onvalue) {
                    await interpreter.onvalue(rest, body, node);
                }
                return rest;
            }
            if (first === ':') {
                // Variable get
                let val = scope.get(rest);
                if (interpreter.onvalue) {
                    await interpreter.onvalue(val, body, node);
                }
                return val;
            }
            throw new SyntaxError('Unexpected token ' + value);
        }

        async function handleArg(prio=0) {
            let retval;
            if (iter.head === '(') {
                // Variadic command
                retval = await handleVariadic();
            } else if (isLiteral(iter.head)) {
                retval = await handleLiteral();
            } else {
                retval = await handleFixed();
            }
            if (isOperator(iter.head)) {
                retval = await handleOperator(retval, prio);
            }
            return retval;
        }

        async function handleOperator(leftValue, oldprio=0) {
            // ...
            let node = iter;
            let op = node.head;
            let prio = precedence[op];
            if (prio < oldprio) {
                return leftValue;
            }

            let func = validateCommand(op, true);
            iter = iter.tail;

            let rightValue = await handleArg(prio);

            if (isOperator(iter.head)) {
                let other = iter.head;
                let newprio = precedence[other];
                if (newprio >= prio) {
                    rightValue = await handleOperator(rightValue, newprio);
                }
            }

            let args = [leftValue, rightValue];
            let retval = await interpreter.performCall(func, args, body, node);

            if (isOperator(iter.head)) {
                let other = iter.head;
                let newprio = precedence[other];
                // chain operators
                retval = await handleOperator(retval, newprio);
            }
            return retval;
        }

        async function handleVariadic(prio=0) {
            // Variadic procedure call (foo arg1 arg2 ...)

            // Consume the "("
            iter = iter.tail;

            // Variadic command
            if (iter.isEmpty()) {
                throw new SyntaxError('End of input expecting variadic command');
            }

            let node = iter;
            let command = node.head;
            let literal;
            let func;
            let args = [];
            if (isProcedure(command)) {
                func = validateCommand(command);
                iter = iter.tail;
            } else {
                literal = await handleArg();
            }
            while (!context.stop) {
                if (iter.isEmpty()) {
                    throw new SyntaxError('End of input expecting variadic arg');
                }
                if (iter.head === ')') {
                    iter = iter.tail;
                    if (func) {
                        if (args.length < func.length) {
                            throw new SyntaxError('Not enough args to ' + command);
                        }
                        return await interpreter.performCall(func, args, body, node);
                    } else {
                        if (args.length) {
                            throw new SyntaxError('Got unexpected args to a literal');
                        }
                        return literal;
                    }
                }
                let retval = await handleArg();
                if (retval === undefined) {
                    throw new SyntaxError('Expected output from arg to ' + command);
                }
                args.push(retval);
            }
            return undefined;
        }

        async function handleFixed(prio=0) {
            // Fixed-length procedure call or literal
            let node = iter;
            let command = node.head;
            if (command === ')') {
                throw new SyntaxError('Unexpected close paren');
            }
            // Hack for unary -
            let func = validateCommand(command);
            let args = [];
            iter = iter.tail;
            while (!context.stop) {
                if (args.length >= func.length) {
                    let retval = await interpreter.performCall(func, args, body, node);
                    return retval;
                }
                if (iter.isEmpty()) {
                    throw new SyntaxError('End of input expecting fixed arg');
                }
                if (iter.head === ')') {
                    throw new SyntaxError('Unexpected close paren');
                }
                let retval = await handleArg(prio);
                if (retval === undefined) {
                    throw new SyntaxError('Expected output from arg to ' + func.name);
                }
                args.push(retval);
            }
            return undefined;
        }

        async function handleTo() {
            let node = iter;

            // consume "to"
            iter = iter.tail;

            if (iter.isEmpty()) {
                throw new SyntaxError('End of input expecting procedure name');
            }
            let name = iter.head;
            if (!isString(name)) {
                throw new SyntaxError('Procedure name must be a word');
            }
            // consume name
            iter = iter.tail;

            let args = [];

            // Collect any :arg names
            for (;;) {
                if (iter.isEmpty()) {
                    throw new SyntaxError('End of input reading procedure definition');
                }
                let arg = iter.head;
                if (isString(arg) && arg[0] === ':') {
                    args.push(arg.substr(1));
                    iter = iter.tail;
                    continue;
                }
                break;
            }

            // Collect the body instructions
            let body = new ListBuilder();
            for(;;) {
                if (iter.isEmpty()) {
                    throw new SyntaxError('End of input reading procedure definition');
                }
                let instruction = iter.head;
                if (instruction === 'end') {
                    // Consume 'end'
                    iter = iter.tail;
                    break;
                }
                // Copy the source-map info from the parser
                body.push(instruction);
                let map = interpreter.sourceForNode(iter);
                if (map) {
                    interpreter.sourceMap.set(body.end, map);
                }
                iter = iter.tail;
            }

            let proc = interpreter.procedure(name, args, body.list);
            interpreter.procedureScope.set(name, proc);
            return;
        }

        let retval;
        while (!context.stop) {
            if (retval !== undefined) {
                if (iter.isEmpty()) {
                    return retval;
                }
                throw new SyntaxError('Extra instructions after a value-returning expression: ' + iter.head);
            }
            if (iter.isEmpty()) {
                break;
            }
            if (iter.head === 'to') {
                await handleTo();
                continue;
            }
            retval = await handleArg();
        }
        return retval;
    }

    // Parse and execute a string in the global context
    async execute(source) {
        if (this.running) {
            // @todo allow pushing it onto a task list
            throw new Error('Logo code is already running');
        }
        let parsed = this.parse(source);
        this.running = true;
        try {
            let retval = await this.evaluate(parsed);
            if (retval !== undefined) {
                throw new SyntaxError('Unhandled output value ' + String(retval));
            }
        } finally {
            // Clean up flags
            this.breakFlag = false;
            this.running = false;
        }
    }

    /**
     * Checks for breaks and pauses
     * Async, as may delay during a pause.
     */
    checkBreak() {
        return new Promise((resolve, reject) => {
            if (this.breakFlag) {
                throw new Error('Break requested');
            }
            if (this.paused) {
                this.oncontinue = () => {
                    resolve();
                };
                this.onbreak = (reason) => {
                    this.oncontinue = null;
                    reject(reason);
                };
            } else {
                resolve();
            }
        });
    }

    pause() {
        if (!this.running) {
            throw new Error('Cannot pause when not running');
        }
        if (this.paused) {
            throw new Error('Already paused');
        }
        this.paused = true;
    }

    continue() {
        if (!this.running) {
            throw new Error('Cannot continue when not running');
        }
        if (!this.paused) {
            throw new Error('Cannot continue when not paused');
        }
        this.paused = false;
        this.oncontinue();
    }

    /**
     * Request a user break of any currently running code.
     * Will throw an exception within the interpreter loop.
     */
    break() {
        if (!this.running) {
            throw new Error('Cannot break when not running');
        }
        if (this.breakFlag) {
            throw new Error('Already breaking');
        }

        // Interpreter loop will check this flag and break
        // out with an internal exception.
        this.breakFlag = true;

        if (this.onbreak) {
            // Async operations may set this callback
            // so we can interrupt them, such as clearing
            // a long-running timeout.
            this.onbreak(new Error('Break requested'));
        }

        if (this.paused) {
            this.continue();
        }
    }
}
