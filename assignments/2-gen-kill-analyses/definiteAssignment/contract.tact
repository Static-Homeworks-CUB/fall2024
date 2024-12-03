fun test(): Int {
    // def = []; use = []; in  = []; out = []
    let a: Int = 0;
    // def = []; use = [a]; in  = [a]; out = []
    while (a < 10) {
        // def = []; use = [a]; in  = []; out = []
        let b: Int = a + 1;
        // def = [a]; use = [b]; in  = []; out = [a]
        a = b;
    }
    // def = []; use = [a]; in  = []; out = []
    return a;
}