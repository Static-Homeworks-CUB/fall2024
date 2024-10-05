contract Test {
    fun example1(): Int {
        while (false) {} // OK: No statements in the body
        return 5;
    }

    fun example2(): Int {
       while (false) {
         while (false) {
            return 7;
         }
       } // Bad
       return 3;
    }
}
