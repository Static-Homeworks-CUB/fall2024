fun test(): Int {

    let x: Int = 2;
    let y: Int = 5;

    if (true) {
        let z: Int = 7;
    } else {
        let z: Int = -7;
    }

    // All reaching: {x: [2], y: [5, "difference"], z: [7, "y"], difference: ["z"]}
    // Reached: {y: [5, "difference"]}
    while (y > 0) {
        // All reaching: {x: [2], y: [5, "difference"], z: [7, "y"], difference: ["z"]}
        // Reached: {}
        let difference: Int = y;

        // All reaching: {x: [2], y: [5, "difference"], z: [7, "y"], difference: ["z"]}
        // Reached: {y: [5, "y - z"], z: [7, "z + y"]}
        x = y;

        // All reaching: {x: [2], y: [5, "difference"], z: ["y"], difference: ["z"]}
        // Reached: {y: [5, "y - z"], z: ["z + y"]}
        y = 9;
    }

    return x;
}

