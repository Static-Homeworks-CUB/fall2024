fun test(): Int {
    // in = {}
    let a: Int = 0;
    // gen = {a}, kill = {a}
    // out = {a}

    // in = {a} + {b} from loop
    while (a < 10) {
    // gen = {}, kill = {}
    // out = {a, b}

        // in = {a} + {b} from loop
        let b: Int = a + 1;
        // gen = {b}, kill = {b}
        // out = {a, b}

        // in = {a, b}
        a = b;
        // gen = {}, kill = {a}
        // out = {b}
    }
    return a;
}