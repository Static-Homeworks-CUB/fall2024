contract Test {
    number: Int as int32 = 0;

    // Tests field assignment
    fun test(): Int {
        self.number = nativeRandom(); // Bad 
        return randomInt(); // OK: No false positive
    }

    // Tests return statement
    fun BadReturn(): Int {
        return nativeRandom(); // Bad
    }

    // Tests detection in arithmetical operations
    fun sumOfTwoRands(): Int {
        return nativeRandom() + nativeRandom();
    } 

    // Tests detection inside a loop
    fun randInLoop(): Int {
        let randNum: Int = 0;
        let i: Int = 0;
        while (i < 10) {            
            i = i + 1;
            randNum = nativeRandom(); // Bad
        }
        return 0;
    }
}