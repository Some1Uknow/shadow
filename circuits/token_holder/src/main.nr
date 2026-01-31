// token_holder - proves user holds >= min_required tokens from real account data

fn main(
    // private inputs
    token_amount: Field,      // amount held
    user_address: Field,      // owner
    token_mint: pub Field,    // required token mint

    account_data: [u8; 165],  // raw spl token account data

    // public inputs
    state_root: pub Field,    // account data hash
    min_required: pub Field   // required threshold
) {
    let parsed_amount = read_u64_le(account_data, 64);
    assert(parsed_amount == token_amount);

    let parsed_owner = field_from_bytes_16(account_data, 32);
    assert(parsed_owner == user_address);

    let parsed_mint = field_from_bytes_16(account_data, 0);
    assert(parsed_mint == token_mint);

    let computed_root = hash_account_data(account_data);
    assert(computed_root == state_root);

    assert(token_amount as u64 >= min_required as u64);
}

#[test]
fn test_valid_holder() {
    let mut data = [0u8; 165];
    data[15] = 1;
    data[47] = 2;
    data[64] = 5;

    let state_root = hash_account_data(data);
    main(
        5,
        2,
        1,
        data,
        state_root,
        3
    );
}

fn read_u64_le(data: [u8; 165], offset: u32) -> Field {
    let mut out = 0;
    let mut factor = 1;
    for i in 0..8 {
        let idx = offset + i;
        out = out + (data[idx] as Field) * factor;
        factor = factor * 256;
    }
    out
}

fn field_from_bytes_16(data: [u8; 165], offset: u32) -> Field {
    let mut out = 0;
    for i in 0..16 {
        let idx = offset + i;
        out = out * 256 + (data[idx] as Field);
    }
    out
}

fn hash_account_data(data: [u8; 165]) -> Field {
    let mut h = 0;
    for i in 0..165 {
        h = h * 31 + (data[i] as Field);
    }
    h
}
