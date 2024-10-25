fun test(): Int {
    let a: Int = 0;
    while (a < 10) {
        let b: Int = a + 1;
        a = b;
        
        b = 42;
        a = 24;
    }
    return a;
}

