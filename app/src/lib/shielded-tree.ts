import * as fs from 'fs/promises';
import * as path from 'path';
import { poseidonHash } from './poseidon';

const TREE_DEPTH = 32;
const ROOT_HISTORY_SIZE = 32;
const DEFAULT_DATA_DIR = path.join(process.cwd(), '.data');
const DEFAULT_TREE_PATH = (treeId: string) =>
    path.join(DEFAULT_DATA_DIR, `shielded-tree-${treeId}.json`);

interface TreeState {
    depth: number;
    nextIndex: number;
    leaves: string[];
    filledSubtrees: string[];
    roots: string[];
}

async function ensureDataDir() {
    await fs.mkdir(DEFAULT_DATA_DIR, { recursive: true });
}

async function loadTree(treeId: string): Promise<TreeState> {
    try {
        const raw = await fs.readFile(DEFAULT_TREE_PATH(treeId), 'utf-8');
        return JSON.parse(raw) as TreeState;
    } catch {
        return {
            depth: TREE_DEPTH,
            nextIndex: 0,
            leaves: [],
            filledSubtrees: Array(TREE_DEPTH).fill('0'),
            roots: ['0'],
        };
    }
}

async function saveTree(treeId: string, state: TreeState) {
    await ensureDataDir();
    await fs.writeFile(DEFAULT_TREE_PATH(treeId), JSON.stringify(state, null, 2));
}

async function hashPair(left: string, right: string): Promise<string> {
    return await poseidonHash([left, right]);
}

export async function insertCommitment(treeId: string, commitment: string): Promise<{ index: number; root: string }> {
    const tree = await loadTree(treeId);
    const index = tree.nextIndex;
    tree.nextIndex += 1;
    tree.leaves[index] = commitment;

    let current = commitment;
    let idx = index;

    for (let level = 0; level < tree.depth; level++) {
        if (idx % 2 === 0) {
            tree.filledSubtrees[level] = current;
            current = await hashPair(current, '0');
        } else {
            const left = tree.filledSubtrees[level] || '0';
            current = await hashPair(left, current);
        }
        idx = Math.floor(idx / 2);
    }

    tree.roots.push(current);
    if (tree.roots.length > ROOT_HISTORY_SIZE) {
        tree.roots.shift();
    }

    await saveTree(treeId, tree);

    return { index, root: current };
}

export async function getMerklePath(treeId: string, index: number): Promise<{ path: string[]; indices: number[]; root: string }> {
    const tree = await loadTree(treeId);
    if (index >= tree.nextIndex) {
        throw new Error('Leaf index out of range');
    }

    const pathElements: string[] = [];
    const pathIndices: number[] = [];

    let idx = index;
    let nodes = tree.leaves.slice();

    for (let level = 0; level < tree.depth; level++) {
        const isRight = idx % 2;
        const siblingIndex = isRight ? idx - 1 : idx + 1;
        const sibling = nodes[siblingIndex] || '0';
        pathElements.push(sibling);
        pathIndices.push(isRight);

        // Build next level
        const nextNodes: string[] = [];
        for (let i = 0; i < nodes.length; i += 2) {
            const left = nodes[i] || '0';
            const right = nodes[i + 1] || '0';
            // eslint-disable-next-line no-await-in-loop
            const parent = await hashPair(left, right);
            nextNodes.push(parent);
        }
        nodes = nextNodes;
        idx = Math.floor(idx / 2);
    }

    const root = tree.roots[tree.roots.length - 1] || '0';
    return { path: pathElements, indices: pathIndices, root };
}

export async function getTreeRoot(treeId: string): Promise<string> {
    const tree = await loadTree(treeId);
    return tree.roots[tree.roots.length - 1] || '0';
}
