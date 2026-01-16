// min_balance circuit - Proves balance >= threshold without revealing actual balance
// ZKGate DEX - Noir v1.0.0-beta.18

fn main(
    balance: Field,        // PRIVATE: User's actual token balance
    threshold: pub Field   // PUBLIC: Minimum required balance
) {
    // Assert that the private balance meets or exceeds the public threshold
    // This allows proving eligibility without revealing exact holdings
    assert(balance.lt(threshold) == false, "Balance must be >= threshold");
}

#[test]
fn test_valid_balance() {
    // Balance of 5000 should pass threshold of 1000
    main(5000, 1000);
}

#[test]
fn test_exact_threshold() {
    // Balance exactly at threshold should pass
    main(1000, 1000);
}

#[test(should_fail)]
fn test_insufficient_balance() {
    // Balance below threshold should fail
    main(500, 1000);
}

#[test]
fn test_large_balance() {
    // Large balance should pass
    main(1000000000, 100);
}
