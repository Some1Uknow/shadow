// token_holder - Proves user holds >= min_required tokens
// 
// LIMITATION: Sunspot (Groth16 prover) has issues with Pedersen hashes
// producing large field elements. Using simplified binding for demo.
// Production version should use Pedersen commitments once Sunspot is fixed.

fn main(
    token_amount: Field,      // PRIVATE: Actual token amount held
    user_address: Field,      // PRIVATE: User's address
    token_mint: pub Field,    // PUBLIC: Token mint to verify
    min_required: pub Field   // PUBLIC: Minimum tokens required
) {
    // Prove: token_amount >= min_required
    assert(token_amount.lt(min_required) == false, "Insufficient token holdings");
    
    // Bind proof to user/token (simplified - no Pedersen due to Sunspot limitation)
    let binding = user_address + token_mint;
    assert(binding != 0, "Invalid binding");
}

#[test]
fn test_valid_holder() {
    main(10000, 0x1234, 0xabcd, 1000);
}

#[test]
fn test_exact_minimum() {
    main(1000, 0x1234, 0xabcd, 1000);
}

#[test(should_fail)]
fn test_insufficient_tokens() {
    main(500, 0x1234, 0xabcd, 1000);
}
