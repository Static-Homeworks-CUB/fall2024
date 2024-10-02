// Tests for constant names
const d: Int = 0; // Bad
const digit: Int = 0; // OK: No false positive

contract Test {
    // Tests for fields
    a: Int = 19; // Bad
    amount: Int = 19; // OK: No false positive

    // Tests for function names
    fun t(): Int { return 42; } // Bad
    fun test(): Int { return 42; } // OK: No false positive

    // Tests for function arguments
    fun extract1(c: Int): Int { return c << 8; } // Bad
    fun extract2(cellNum: Int): Int { return cellNum << 8; } // OK: No false positive
}
