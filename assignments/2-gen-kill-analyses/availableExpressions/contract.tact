fun test(): Int {
    let a: Int = 0;
    let c: Int = 2;
    
    while (a < 10) {
        let b: Int = a + 1;
        if (b % 2 == 0) {
            let d: Int = b * c;
            a = d - 1;
            let o: Int = a + b;
        } else {
            let e: Int = a * c;
            a = e + 2;
            let o: Int = a + b;
        }
    }

    let f: Int = a + c;
    return f;
}
