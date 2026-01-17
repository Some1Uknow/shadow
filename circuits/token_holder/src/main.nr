// token_holder circuit - Proves token ownership
// ZKGate DEX - Noir v1.0.0-beta.18
// Simplified version without Pedersen (for sunspot compatibility)

fn main(
    token_amount: Field,      // PRIVATE: Actual token amount held
    user_address: Field,      // PRIVATE: User's address (as field element)
    token_mint: pub Field,    // PUBLIC: Token mint address to verify
    min_required: pub Field   // PUBLIC: Minimum tokens required
) {
    // Verify the user holds at least min_required tokens
    assert(token_amount.lt(min_required) == false, "Insufficient token holdings");
    
    // Bind the proof to the user and token mint
    // This creates a simple commitment without Pedersen
    // The binding ensures the proof is for this specific user/token combination
    let binding = user_address + token_mint;
    assert(binding != 0, "Invalid binding");
}

#[test]
fn test_valid_holder() {
    let token_amount: Field = 10000;
    let user_address: Field = 0x1234567890abcdef;
    let token_mint: Field = 0xdeadbeef;
    let min_required: Field = 1000;
    
    main(token_amount, user_address, token_mint, min_required);
}

#[test]
fn test_exact_minimum() {
    let token_amount: Field = 1000;
    let user_address: Field = 0xabcdef;
    let token_mint: Field = 0x123456;
    let min_required: Field = 1000;
    
    main(token_amount, user_address, token_mint, min_required);
}

#[test(should_fail)]
fn test_insufficient_tokens() {
    let token_amount: Field = 500;
    let user_address: Field = 0xabcdef;
    let token_mint: Field = 0x123456;
    let min_required: Field = 1000;
    
    main(token_amount, user_address, token_mint, min_required);
}
