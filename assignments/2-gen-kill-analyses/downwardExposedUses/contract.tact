fun test(): Int {
    let a: Int = 0;
    while (a < 10) {
        let b: Int = a + 1;
        a = b;
    }
    a = 14 + 15;
    return a;
}

