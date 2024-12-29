fun test(): Int {

    let x: Int = 2;
    let y: Int = 5;

    if (true) {
        let z: Int = 7;
    } else {
        let z: Int = -7;
    }

    // All reaching: {x: [2], y: [5], z: [7, -7], difference: ["y"]}
    while (y > 0) {
        // All reaching: {x: [2], y: [5], z: [7, -7], difference: ["y"]}
        let difference: Int = y;

        // All reaching: {x: [2], y: [5], z: [7, -7], difference: ["y"]}
        x = y;

        // Based on the issue description, only Let statements create definition, so x: ["y"] should not appear

        // All reaching: {y: [5], z: [7, -7], difference: ["y"]}
        y = 9;
    }

    return x;
}

