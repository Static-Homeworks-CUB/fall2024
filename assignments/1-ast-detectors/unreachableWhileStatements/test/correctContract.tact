contract Test {
    fun example1(): Int {
        while (false) {} // OK: No statements in the body
        return 5;
    }

    fun example2(): Int {
       while (true) {
         while (true) {
            return 7;
         } // OK
         while (false) {} // OK
       } // OK: No statements in the body
       return 3;
    }

    fun example3(falseConst: Bool): Int {
        while (falseConst) {
            return 0;
        } // OK
        return 5;
    }

    fun example4(): Int {
        while (true && false) {
            return 5;
        } // OK: We do not evaluate expressions inside of while condition

        return 5;
    }
}
