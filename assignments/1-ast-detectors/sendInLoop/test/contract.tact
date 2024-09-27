contract Test {
    num: Int = 0;

    fun tWhile(): Int { 
        let i: Int = 0;
        while (i < 10) {
            send(SendParameters{
                to: sender(),
                value: i,
            });
            i = i + 1;
        }
        return i;
    }
}
