fun test(): Int {
    let a: Int = 0;
    while (a < 10) {
        a = 24;
        let b: Int = a + 1;
        if (b > 0) {
            a = a + 5;
            b = 10;
        } else {
            a = 6;
            b = b + 3
        }
        let c: Int = a + b;
    }
    return a;
}

