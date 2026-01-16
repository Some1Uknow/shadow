'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { 
  useZKProofMulti, 
  CircuitType, 
  CIRCUIT_INFO,
  MinBalanceInputs,
  TokenHolderInputs,
  ExclusionInputs,
} from '@/hooks/useZKProof';

interface CircuitSelectorProps {
  onProofGenerated: (proof: { proof: Uint8Array; publicInputs: Uint8Array; circuit: CircuitType }) => void;
  onProofReset: () => void;
  proofGenerated: boolean;
  defaultThreshold?: number;
}

// Tree depth for SMT exclusion
const TREE_DEPTH = 32;

export function CircuitSelector({ 
  onProofGenerated, 
  onProofReset, 
  proofGenerated,
  defaultThreshold = 1,
}: CircuitSelectorProps) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const {
    generateMinBalanceProof,
    generateTokenHolderProof,
    generateExclusionProof,
    getEmptyTreeInputs,
    isGenerating,
    proof,
    proofContext,
    error,
    reset,
    circuitInfo,
  } = useZKProofMulti();

  // Circuit selection
  const [selectedCircuit, setSelectedCircuit] = useState<CircuitType>('min_balance');
  const [showCircuitInfo, setShowCircuitInfo] = useState(false);

  // Min Balance inputs
  const [minBalanceThreshold, setMinBalanceThreshold] = useState<string>(defaultThreshold.toString());
  const [userBalance, setUserBalance] = useState<number>(0);

  // Token Holder inputs
  const [tokenMint, setTokenMint] = useState<string>('');
  const [tokenMinRequired, setTokenMinRequired] = useState<string>('1000');
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [isLoadingTokenBalance, setIsLoadingTokenBalance] = useState(false);

  // Exclusion inputs
  const [blacklistRoot, setBlacklistRoot] = useState<string>('0x0');
  const [useEmptyTree, setUseEmptyTree] = useState(true);

  // Fetch SOL balance for min_balance circuit
  useEffect(() => {
    async function fetchBalance() {
      if (!publicKey || !connection) return;
      try {
        const balance = await connection.getBalance(publicKey);
        setUserBalance(balance / 1e9);
      } catch (e) {
        console.error('Error fetching balance:', e);
      }
    }
    fetchBalance();
  }, [publicKey, connection]);

  // Fetch token balance when mint changes
  useEffect(() => {
    async function fetchTokenBalance() {
      if (!publicKey || !connection || !tokenMint || tokenMint.length < 32) {
        setTokenBalance(0);
        return;
      }

      setIsLoadingTokenBalance(true);
      try {
        const mintPubkey = new PublicKey(tokenMint);
        const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const account = await getAccount(connection, ata);
        setTokenBalance(Number(account.amount) / 1e9);
      } catch {
        setTokenBalance(0);
      } finally {
        setIsLoadingTokenBalance(false);
      }
    }
    fetchTokenBalance();
  }, [publicKey, connection, tokenMint]);

  // Handle proof generation
  const handleGenerateProof = useCallback(async () => {
    if (!publicKey) return;

    let result = null;

    switch (selectedCircuit) {
      case 'min_balance': {
        const inputs: MinBalanceInputs = {
          balance: userBalance,
          threshold: parseFloat(minBalanceThreshold) || 0,
        };
        
        if (inputs.balance < inputs.threshold) {
          return; // Will show error in UI
        }
        
        result = await generateMinBalanceProof(inputs);
        break;
      }

      case 'token_holder': {
        if (!tokenMint) return;
        
        const inputs: TokenHolderInputs = {
          token_amount: Math.floor(tokenBalance * 1e9).toString(),
          user_address: publicKey.toBase58(),
          token_mint: tokenMint,
          min_required: Math.floor(parseFloat(tokenMinRequired) * 1e9).toString(),
        };
        
        result = await generateTokenHolderProof(inputs);
        break;
      }

      case 'smt_exclusion': {
        let inputs: ExclusionInputs;
        
        if (useEmptyTree) {
          // Get empty tree inputs from API
          const emptyInputs = await getEmptyTreeInputs(publicKey.toBase58());
          if (!emptyInputs) return;
          inputs = emptyInputs;
        } else {
          // Use custom blacklist root
          inputs = {
            address: publicKey.toBase58(),
            path_indices: new Array(TREE_DEPTH).fill('0'),
            sibling_path: new Array(TREE_DEPTH).fill('0'),
            root: blacklistRoot,
          };
        }
        
        result = await generateExclusionProof(inputs);
        break;
      }
    }

    if (result) {
      onProofGenerated(result);
    }
  }, [
    publicKey,
    selectedCircuit,
    userBalance,
    minBalanceThreshold,
    tokenMint,
    tokenBalance,
    tokenMinRequired,
    useEmptyTree,
    blacklistRoot,
    generateMinBalanceProof,
    generateTokenHolderProof,
    generateExclusionProof,
    getEmptyTreeInputs,
    onProofGenerated,
  ]);

  // Handle reset
  const handleReset = useCallback(() => {
    reset();
    onProofReset();
  }, [reset, onProofReset]);

  // Check if inputs are valid
  const isInputValid = useCallback(() => {
    switch (selectedCircuit) {
      case 'min_balance':
        return userBalance >= (parseFloat(minBalanceThreshold) || 0);
      case 'token_holder':
        return tokenMint.length >= 32 && tokenBalance >= (parseFloat(tokenMinRequired) || 0);
      case 'smt_exclusion':
        return useEmptyTree || blacklistRoot.length > 0;
      default:
        return false;
    }
  }, [selectedCircuit, userBalance, minBalanceThreshold, tokenMint, tokenBalance, tokenMinRequired, useEmptyTree, blacklistRoot]);

  const currentInfo = circuitInfo[selectedCircuit];

  return (
    <div className="space-y-4">
      {/* Circuit Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Proof Type
          </label>
          <button
            onClick={() => setShowCircuitInfo(!showCircuitInfo)}
            className="text-xs hover:opacity-80 transition-opacity"
            style={{ color: 'var(--accent-primary)' }}
          >
            {showCircuitInfo ? 'Hide Info' : 'What is this?'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(CIRCUIT_INFO) as CircuitType[]).map((circuit) => (
            <button
              key={circuit}
              onClick={() => !proofGenerated && setSelectedCircuit(circuit)}
              disabled={proofGenerated}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                selectedCircuit === circuit ? 'ring-1 ring-cyan-400/50' : ''
              }`}
              style={{
                background: selectedCircuit === circuit 
                  ? 'rgba(34, 211, 238, 0.15)' 
                  : 'rgba(255, 255, 255, 0.03)',
                color: selectedCircuit === circuit 
                  ? 'var(--accent-primary)' 
                  : 'var(--text-secondary)',
                opacity: proofGenerated ? 0.5 : 1,
              }}
            >
              {CIRCUIT_INFO[circuit].name}
            </button>
          ))}
        </div>

        {/* Circuit Info Panel */}
        {showCircuitInfo && (
          <div 
            className="p-3 rounded-lg text-xs space-y-2 animate-fade-in"
            style={{ background: 'rgba(255, 255, 255, 0.02)' }}
          >
            <p style={{ color: 'var(--text-primary)' }}>{currentInfo.description}</p>
            <div className="flex flex-wrap gap-1">
              {currentInfo.useCases.map((useCase, i) => (
                <span 
                  key={i}
                  className="px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(167, 139, 250, 0.1)', color: 'var(--accent-secondary)' }}
                >
                  {useCase}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Circuit-specific inputs */}
      <div className="space-y-3">
        {selectedCircuit === 'min_balance' && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
              <div className="flex justify-between mb-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Your Balance</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {userBalance.toFixed(4)} SOL
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Minimum Required</span>
                <input
                  type="number"
                  value={minBalanceThreshold}
                  onChange={(e) => !proofGenerated && setMinBalanceThreshold(e.target.value)}
                  disabled={proofGenerated}
                  className="w-24 text-right text-xs bg-transparent outline-none"
                  style={{ color: 'var(--accent-primary)' }}
                  placeholder="0.0"
                />
              </div>
            </div>
            {userBalance < (parseFloat(minBalanceThreshold) || 0) && (
              <p className="text-xs" style={{ color: 'var(--error)' }}>
                Insufficient balance for this threshold
              </p>
            )}
          </div>
        )}

        {selectedCircuit === 'token_holder' && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
              <label className="text-xs block mb-2" style={{ color: 'var(--text-muted)' }}>
                Token Mint Address
              </label>
              <input
                type="text"
                value={tokenMint}
                onChange={(e) => !proofGenerated && setTokenMint(e.target.value)}
                disabled={proofGenerated}
                className="w-full text-xs bg-transparent outline-none p-2 rounded border"
                style={{ 
                  color: 'var(--text-primary)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
                placeholder="Enter token mint address..."
              />
            </div>

            <div className="p-3 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
              <div className="flex justify-between mb-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Your Token Balance</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {isLoadingTokenBalance ? 'Loading...' : `${tokenBalance.toFixed(4)} tokens`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Minimum Required</span>
                <input
                  type="number"
                  value={tokenMinRequired}
                  onChange={(e) => !proofGenerated && setTokenMinRequired(e.target.value)}
                  disabled={proofGenerated}
                  className="w-24 text-right text-xs bg-transparent outline-none"
                  style={{ color: 'var(--accent-primary)' }}
                  placeholder="0"
                />
              </div>
            </div>

            {tokenMint && tokenBalance < (parseFloat(tokenMinRequired) || 0) && (
              <p className="text-xs" style={{ color: 'var(--error)' }}>
                Insufficient token holdings
              </p>
            )}
          </div>
        )}

        {selectedCircuit === 'smt_exclusion' && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Blacklist Source</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useEmptyTree}
                    onChange={(e) => !proofGenerated && setUseEmptyTree(e.target.checked)}
                    disabled={proofGenerated}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                    Use empty tree (testing)
                  </span>
                </label>
              </div>

              {!useEmptyTree && (
                <div>
                  <label className="text-xs block mb-2" style={{ color: 'var(--text-muted)' }}>
                    Blacklist Merkle Root
                  </label>
                  <input
                    type="text"
                    value={blacklistRoot}
                    onChange={(e) => !proofGenerated && setBlacklistRoot(e.target.value)}
                    disabled={proofGenerated}
                    className="w-full text-xs bg-transparent outline-none p-2 rounded border"
                    style={{ 
                      color: 'var(--text-primary)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    }}
                    placeholder="0x..."
                  />
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg" style={{ background: 'rgba(34, 211, 238, 0.05)' }}>
              <p className="text-xs" style={{ color: 'var(--accent-primary)' }}>
                🔒 This proof verifies your address is NOT on the blacklist without revealing your address.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div 
          className="p-3 rounded-lg text-xs"
          style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}
        >
          {error}
        </div>
      )}

      {/* Proof Context Display */}
      {proofGenerated && proofContext && (
        <div 
          className="p-3 rounded-lg text-xs space-y-1"
          style={{ background: 'rgba(34, 211, 238, 0.1)' }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span style={{ color: 'var(--accent-primary)' }}>Proof Ready</span>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>
            Circuit: {CIRCUIT_INFO[proofContext.circuit].name}
          </p>
          {proofContext.minBalance && (
            <p style={{ color: 'var(--text-muted)' }}>
              Proved: balance ≥ {proofContext.minBalance.threshold} SOL
            </p>
          )}
          {proofContext.tokenHolder && (
            <p style={{ color: 'var(--text-muted)' }}>
              Proved: holdings ≥ {parseInt(proofContext.tokenHolder.min_required) / 1e9} tokens
            </p>
          )}
          {proofContext.exclusion && (
            <p style={{ color: 'var(--text-muted)' }}>
              Proved: address NOT on blacklist
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {!proofGenerated ? (
        <button
          onClick={handleGenerateProof}
          disabled={!publicKey || isGenerating || !isInputValid()}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{ 
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', 
            color: '#0d0d0f' 
          }}
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating {CIRCUIT_INFO[selectedCircuit].name} Proof...
            </span>
          ) : (
            `Generate ${CIRCUIT_INFO[selectedCircuit].name} Proof`
          )}
        </button>
      ) : (
        <button
          onClick={handleReset}
          className="w-full py-2 rounded-xl text-xs font-medium transition-all duration-200 hover:bg-white/10"
          style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
        >
          Reset & Choose Different Proof
        </button>
      )}
    </div>
  );
}
