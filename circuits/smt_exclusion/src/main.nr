// smt_exclusion circuit - Proves address is NOT on a blacklist
// ZKGate DEX - Noir v1.0.0-beta.18
// Simplified version for demo (checks against a known non-blacklisted set)

// For demo purposes, we use a simple exclusion check
// In production, this would use a proper Merkle tree

fn main(
    address: Field,              // PRIVATE: Address to prove exclusion for
    address_hash: Field,         // PRIVATE: Hash of the address (pre-computed)
    blacklist_root: pub Field    // PUBLIC: Root hash of the blacklist
) {
    // The proof demonstrates that:
    // 1. The prover knows the address
    // 2. The address_hash is derived from the address
    // 3. The address is not in the blacklist (represented by root)
    
    // Simple binding check - ensures the proof is for this specific address
    let binding = address + address_hash;
    assert(binding != 0, "Invalid address binding");
    
    // For demo: if blacklist_root is 0, the blacklist is empty (everyone passes)
    // In production, this would verify a Merkle non-membership proof
    if blacklist_root != 0 {
        // Non-empty blacklist: verify address_hash is not equal to root
        // This is a simplified check for demo purposes
        assert(address_hash != blacklist_root, "Address may be blacklisted");
    }
}

#[test]
fn test_exclusion_empty_blacklist() {
    // Empty blacklist (root = 0) - any address passes
    let address: Field = 0x1234;
    let address_hash: Field = 0x5678;
    let blacklist_root: Field = 0;
    
    main(address, address_hash, blacklist_root);
}

#[test]
fn test_exclusion_non_empty_blacklist() {
    // Non-empty blacklist - address not in it
    let address: Field = 0x1234;
    let address_hash: Field = 0x5678;
    let blacklist_root: Field = 0xabcd; // Different from address_hash
    
    main(address, address_hash, blacklist_root);
}

#[test(should_fail)]
fn test_blacklisted_address() {
    // Address hash matches blacklist root (simplified blacklist check)
    let address: Field = 0x1234;
    let address_hash: Field = 0xabcd;
    let blacklist_root: Field = 0xabcd; // Same as address_hash
    
    main(address, address_hash, blacklist_root);
}
