contract Test {
    fun testSimple() {
        let simple: Int = 42;
        while (simple > 0) { // Bad
        }
    }

    fun testSimpleUntil() {
        let simpleUntil: Int = 42;
        do {} until (simpleUntil > 0); // Bad
    }

    fun testNested() { // Bad
        let nested: Int = 42;
        while (nested > 0) {
            if (true) {
                while (false) {
                }
            }
        }
    }

    fun testMultiple() {
        let v1 = 1;
        let v2 = 2;
        while (v1 > 0 || v2 > 0) {
        }
    }

    // Ensure no false positives

    fun testVariableRead() { // OK: variable is read in the loop body
        let variableRead: Int = 42;
        while (variableRead > 0) {
            variableRead
        }
    }

    fun testMultipleOneUsed() {
        let v1 = 1;
        let v2 = 2;
        let v3 = 3;
        while (v1 > 0 || v2 > 0 || v3 > 0) {
            v1;
        }
    }

    fun testVariableReassigned() {
        let variableReassigned: Int = 42;
        while (variableReassigned > 0) {
            variableReassigned = 1;
        }
    }

    fun testVariableAugmentedOp() {
        let variableAugmentedOp: Int = 42;
        while (variableAugmentedOp > 0) {
            variableAugmentedOp += 1;
        }
    }

    fun testVariableUsedInNestedWhile() {
        let variableUsedInNestedWhile: Int = 42;
        while (variableUsedInNestedWhile > 0) {
            if (true) {
                do { variableUsedInNestedWhile } until (variableUsedInNestedWhile > 0);
            }
        }
    }
}