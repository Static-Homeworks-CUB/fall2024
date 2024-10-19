contract ConditionalTest {
    number: Int as int32 = 0;

    fun letStatement(a: Int) {
        let b: Int = a + 5;
    }

    fun assignment(a: Int) {
        self.number = a + 5;
    }

    // No warnings because 1 is an allowed constant
    fun assignmentWithAllowedConstant(a: Int) {
        self.number = a + 1
    }

    fun inStaticCall(a: Int) {
        abs(a - 5)
    }

    fun inReturn(a: Int): Int {
        return a + 5
    }

}