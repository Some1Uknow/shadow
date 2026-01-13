'use client';

interface ProofStatusProps {
  proofGenerated: boolean;
}

export function ProofStatus({ proofGenerated }: ProofStatusProps) {
  return (
    <div className="bg-gray-900/80 rounded-2xl p-6 border border-gray-800">
      <h2 className="text-xl font-semibold mb-6">ZK Proof Status</h2>

      <div className="space-y-4">
        {/* Proof Generation Status */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`w-3 h-3 rounded-full ${
                proofGenerated ? 'bg-green-500' : 'bg-gray-500'
              }`}
            />
            <span className="text-sm font-medium">
              {proofGenerated ? 'Proof Generated' : 'Awaiting Proof'}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            {proofGenerated
              ? 'Your ZK proof is ready. You can now execute swaps.'
              : 'Generate a proof to verify your eligibility for trading.'}
          </p>
        </div>

        {/* Circuit Info */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h3 className="text-sm text-gray-400 mb-3">Circuit: min_balance</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Type</span>
              <span className="text-purple-400">Groth16</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Curve</span>
              <span className="text-purple-400">BN254</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Verifier</span>
              <span className="text-purple-400">Sunspot</span>
            </div>
          </div>
        </div>

        {/* What's Being Proven */}
        <div className="bg-gray-800/50 rounded-lg p-4">
          <h3 className="text-sm text-gray-400 mb-3">What You're Proving</h3>
          <ul className="space-y-2 text-xs text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>Your balance meets the minimum threshold</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>Without revealing your actual balance</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>Proof is verified on-chain</span>
            </li>
          </ul>
        </div>

        {/* Privacy Notice */}
        <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-4">
          <h3 className="text-sm text-purple-400 mb-2">Privacy Preserved</h3>
          <p className="text-xs text-gray-400">
            Your actual token balance remains private. Only the validity of
            your proof (that balance ≥ threshold) is verified on-chain.
          </p>
        </div>

        {/* Available Circuits */}
        <div className="mt-6">
          <h3 className="text-sm text-gray-400 mb-3">Available Circuits</h3>
          <div className="space-y-2">
            <CircuitBadge name="min_balance" active />
            <CircuitBadge name="token_holder" />
            <CircuitBadge name="smt_exclusion" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CircuitBadge({ name, active = false }: { name: string; active?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
        active
          ? 'bg-purple-600/20 border border-purple-500/50 text-purple-300'
          : 'bg-gray-800/50 border border-gray-700 text-gray-400'
      }`}
    >
      <span>{name}</span>
      {active && <span className="text-green-400">Active</span>}
    </div>
  );
}
