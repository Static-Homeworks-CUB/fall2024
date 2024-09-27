contract ConditionalTest {
    // Example that should trigger the detector
    fun checkValue1(a: Int) {
        if (a > 10) {
            // Do something
        }
        else if (a > 5) {
            // Do something else
        }
        // Missing else clause here - Bad
    }

    // Example with no else if clauses - should not trigger the detector
    fun checkValue2(d: Int) {
        if (d % 2 == 0) {
            // Even number
        }
        else {
            // Do something else
        }
        // Only if and else - OK
    }



    fun checkValue3(f: Int) {
        if (f > 100) {
            // Do something
            if (f > 200) {
                // Nested condition
            }
            else if (f > 150) {
                // Nested else if
            }
            else {
               // Do something else
            }
        }
        else if (f > 50) {
            // Do something else
        }
        else {
            // Do something else
        }
        // Proper use of else clauses - OK
    }

    fun checkValue4(a: Int) {
        if (a > 10) {
            // Do something
        }
        // Only if - OK 
    }

}