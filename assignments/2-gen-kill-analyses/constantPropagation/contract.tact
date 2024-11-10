contract ConstantPropagationTest {
    field: Int as uint32 = 0;

    fun ifElseTest(): Int {
        let a: Int = 0;
        let x: Int = a + 5;

        if (a > 5) {
            x = abs(x);
        } else {
            x = x + 3;
        }
        
        return a;
    }

    fun whileTest(): Int {
        let a: Int = 0;
        let x: Int = a;

        while (a < 5) {
            x += 1;
        }

        return a;
    }

    fun fieldTest() {
        self.field = -5;
        self.field = abs(self.field);
    }

    fun foreachTest(): Int {
        let cells: map<Int, Int> = emptyMap();
        let sum: Int = 0;

        foreach (key, value in cells) {
            sum += value;
        }

        return sum;
    }
}
