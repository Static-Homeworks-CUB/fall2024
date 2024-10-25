fun test(): Int {
    let a: Int = 0;
    let x: Int = a + 5;
    if (true) {
        x = abs(x)
    } else {
        x = x + 3
    }
    while (a < 10) {
        let b: Int = a + 1;
        a = b;
    }
    return a;
}

