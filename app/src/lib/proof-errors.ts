/**
 * Proof Error Codes & Response Helpers
 * Standardized error handling for ZK proof API routes
 */

import { NextResponse } from 'next/server';

// Error Codes

export const ProofErrorCodes = {
    // Validation errors (4xx)
    MISSING_PARAMS: 'MISSING_PARAMS',
    INVALID_BALANCE: 'INVALID_BALANCE',
    BALANCE_BELOW_THRESHOLD: 'BALANCE_BELOW_THRESHOLD',
    INSUFFICIENT_HOLDINGS: 'INSUFFICIENT_HOLDINGS',
    ADDRESS_BLACKLISTED: 'ADDRESS_BLACKLISTED',

    // Setup/tool errors (5xx)
    NARGO_NOT_FOUND: 'NARGO_NOT_FOUND',
    SUNSPOT_NOT_FOUND: 'SUNSPOT_NOT_FOUND',
    TOOLS_NOT_AVAILABLE: 'TOOLS_NOT_AVAILABLE',
    CIRCUIT_NOT_COMPILED: 'CIRCUIT_NOT_COMPILED',
    SETUP_REQUIRED: 'SETUP_REQUIRED',

    // Runtime errors (5xx)
    WITNESS_GENERATION_FAILED: 'WITNESS_GENERATION_FAILED',
    PROOF_GENERATION_FAILED: 'PROOF_GENERATION_FAILED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ProofErrorCode = typeof ProofErrorCodes[keyof typeof ProofErrorCodes];

// Error Response Builder

export interface ProofErrorResponse {
    error: string;
    errorCode: ProofErrorCode;
    details?: string;
}

export function createErrorResponse(
    errorCode: ProofErrorCode,
    error: string,
    status: number = 400,
    details?: string
): NextResponse<ProofErrorResponse> {
    return NextResponse.json(
        { error, errorCode, ...(details && { details }) },
        { status }
    );
}

// Common Error Responses

export function missingParamsError(params: string[]): NextResponse<ProofErrorResponse> {
    return createErrorResponse(
        ProofErrorCodes.MISSING_PARAMS,
        `Missing required parameters: ${params.join(', ')}`,
        400,
        `All parameters must be provided: ${params.join(', ')}`
    );
}

export function toolsNotAvailableError(missing: { nargo?: boolean; sunspot?: boolean }): NextResponse<ProofErrorResponse> {
    const missingTools: string[] = [];
    if (!missing.nargo) missingTools.push('nargo');
    if (!missing.sunspot) missingTools.push('sunspot');

    return createErrorResponse(
        ProofErrorCodes.TOOLS_NOT_AVAILABLE,
        `Required tools not found: ${missingTools.join(', ')}`,
        500,
        'Install nargo: noirup -v 1.0.0-beta.1 | Install sunspot: see sunspot repo'
    );
}

export function circuitNotCompiledError(circuitName: string): NextResponse<ProofErrorResponse> {
    return createErrorResponse(
        ProofErrorCodes.CIRCUIT_NOT_COMPILED,
        'Circuit not compiled',
        500,
        `Run: cd circuits/${circuitName} && nargo compile`
    );
}

export function witnessGenerationError(details: string): NextResponse<ProofErrorResponse> {
    return createErrorResponse(
        ProofErrorCodes.WITNESS_GENERATION_FAILED,
        'Witness generation failed',
        500,
        details
    );
}

export function proofGenerationError(details: string): NextResponse<ProofErrorResponse> {
    return createErrorResponse(
        ProofErrorCodes.PROOF_GENERATION_FAILED,
        'Proof generation failed',
        500,
        details
    );
}

export function internalError(details: string): NextResponse<ProofErrorResponse> {
    return createErrorResponse(
        ProofErrorCodes.INTERNAL_ERROR,
        'Internal error',
        500,
        details
    );
}
