// smt_exclusion - Proves address is NOT on a blacklist
//
// LIMITATION: Full SMT with Pedersen hashes fails in Sunspot due to 
// large field element handling issues. Using simplified check for demo.
// Production should use proper Merkle non-membership proofs.

fn main(
    address: Field,              // PRIVATE: Address to prove exclusion for
    address_hash: Field,         // PRIVATE: Derived from address
    blacklist_root: pub Field    // PUBLIC: Blacklist root (0 = empty)
) {
    // Bind proof to this address
    let binding = address + address_hash;
    assert(binding != 0, "Invalid binding");
    
    // If blacklist is non-empty, verify address not in it
    if blacklist_root != 0 {
        assert(address_hash != blacklist_root, "Address may be blacklisted");
    }
}

#[test]
fn test_empty_blacklist() {
    main(0x1234, 0x5678, 0); // Empty blacklist - passes
}

#[test]
fn test_not_blacklisted() {
    main(0x1234, 0x5678, 0xabcd); // Different from hash - passes
}

#[test(should_fail)]
fn test_blacklisted() {
    main(0x1234, 0xabcd, 0xabcd); // Hash matches root - fails
}
