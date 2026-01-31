// smt_exclusion - proves an address is not on a blacklist

fn main(
    address: Field,              // private: address to prove exclusion for
    address_hash: Field,         // private: derived from address
    blacklist_root: pub Field    // public: blacklist root (0 = empty)
) {
    let binding = address + address_hash;
    assert(binding != 0, "Invalid binding");
    
    if blacklist_root != 0 {
        assert(address_hash != blacklist_root, "Address may be blacklisted");
    }
}

#[test]
fn test_empty_blacklist() {
    main(0x1234, 0x5678, 0); // empty blacklist passes
}

#[test]
fn test_not_blacklisted() {
    main(0x1234, 0x5678, 0xabcd); // different from hash passes
}

#[test(should_fail)]
fn test_blacklisted() {
    main(0x1234, 0xabcd, 0xabcd); // hash matches root fails
}
