/**
 * @project AncestorTree
 * @file src/app/api/desktop-db/rpc-handlers.ts
 * @description RPC function handlers for desktop mode.
 *              Implements is_person_in_subtree (DFS via CTE).
 * @version 1.0.0
 * @updated 2026-02-26
 */

import type { Database } from 'sql.js';

/**
 * Check if target_id is in the subtree rooted at root_id.
 * Uses iterative DFS through families/children tables.
 */
function isPersonInSubtree(
  db: Database,
  rootId: string,
  targetId: string,
): boolean {
  if (rootId === targetId) return true;

  // BFS/DFS through family tree
  const visited = new Set<string>();
  const queue = [rootId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // Find families where this person is a parent
    const families = db.exec(
      `SELECT id FROM families WHERE father_id = '${currentId}' OR mother_id = '${currentId}'`
    );

    if (families.length > 0) {
      for (const row of families[0].values) {
        const familyId = row[0] as string;
        // Find children in this family
        const children = db.exec(
          `SELECT person_id FROM children WHERE family_id = '${familyId}'`
        );
        if (children.length > 0) {
          for (const childRow of children[0].values) {
            const childId = childRow[0] as string;
            if (childId === targetId) return true;
            if (!visited.has(childId)) {
              queue.push(childId);
            }
          }
        }
      }
    }
  }

  return false;
}

export interface RpcResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

/** Dispatch RPC function call */
export function handleRpc(
  db: Database,
  functionName: string,
  params: Record<string, unknown>,
): RpcResult {
  switch (functionName) {
    case 'is_person_in_subtree': {
      const rootId = params.root_id as string;
      const targetId = params.target_id as string;
      if (!rootId || !targetId) {
        return { data: null, error: { message: 'Missing root_id or target_id' } };
      }
      const result = isPersonInSubtree(db, rootId, targetId);
      return { data: result, error: null };
    }

    default:
      return {
        data: null,
        error: { message: `Unknown RPC function: ${functionName}` },
      };
  }
}
