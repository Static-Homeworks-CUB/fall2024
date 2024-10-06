contract Test {
    fun example(): Int {
       while (false) {
         while (false) {
            return 7;
         } // Bad
       } // Bad
       return 3;
    }
}
