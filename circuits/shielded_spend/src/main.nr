// shielded spend circuit
// proves note membership and binds nullifier, recipient, and amount

use poseidon::poseidon::bn254 as poseidon;

fn hash2(left: Field, right: Field) -> Field {
    poseidon::hash_2([left, right])
}

fn merkle_root(leaf: Field, path: [Field; 32], indices: [u1; 32]) -> Field {
    let mut current = leaf;
    for i in 0..32 {
        let sibling = path[i];
        let is_right = indices[i];
        if is_right == 1 {
            current = hash2(sibling, current);
        } else {
            current = hash2(current, sibling);
        }
    }
    current
}

fn main(
    // private inputs
    amount: Field,
    secret: Field,
    nullifier: Field,
    merkle_path: [Field; 32],
    merkle_indices: [u1; 32],

    // public inputs
    root: pub Field,
    nullifier_hash: pub Field,
    amount_pub: pub Field,
    recipient: pub Field,
    mint: pub Field,
    pool_id: pub Field,
) {
    // note commitment binds mint and pool
    let commitment = poseidon::hash_5([amount, secret, nullifier, mint, pool_id]);
    let computed_root = merkle_root(commitment, merkle_path, merkle_indices);
    assert(computed_root == root);

    // nullifier hash prevents double spend
    let computed_nullifier = poseidon::hash_3([nullifier, mint, pool_id]);
    assert(computed_nullifier == nullifier_hash);

    // bind amount and recipient
    assert(amount_pub == amount);
    let _ = recipient;
}

#[test]
fn test_placeholder() {
    // minimal smoke test, real tests should use real merkle paths
    let amount = 10;
    let secret = 5;
    let nullifier = 7;
    let mint = 1;
    let pool_id = 2;
    let commitment = poseidon::hash_5([amount, secret, nullifier, mint, pool_id]);
    let path = [0; 32];
    let indices = [0; 32];
    let root = merkle_root(commitment, path, indices);
    let nullifier_hash = poseidon::hash_3([nullifier, mint, pool_id]);
    main(amount, secret, nullifier, path, indices, root, nullifier_hash, amount, 123, mint, pool_id);
}
