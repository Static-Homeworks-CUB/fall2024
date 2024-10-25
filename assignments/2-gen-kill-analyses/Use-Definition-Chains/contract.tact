fun test(): Int {
    let a: Int = 0;
    let b: Int = a + 1;
    a = b;
    let c: Int = a + 1;
    a = c;
    return a;
}
