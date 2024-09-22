contract Test {
    fun foo(): Int {
        let bar = 42; // Bad
        let baz: Int = 22; // Ok
        return bar + baz; 
    }
}
