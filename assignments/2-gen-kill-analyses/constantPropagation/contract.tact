fun test(): Int {
    // gen = []; kill = [a]; in = []; out = [a]
    let a: Int = 0;
    // gen = [a]; kill = []; in = [a]; out = [a]
    while (a < 10) {
        // gen = [a]; kill = [b]; in = [a]; out = [b]
        let b: Int = a + 1;
        // gen = [b]; kill = [a]; in = [b]; out = [a]
        a = b;
    }
    // gen = [a]; kill = []; in = [a]; out = []
    return a;
}

