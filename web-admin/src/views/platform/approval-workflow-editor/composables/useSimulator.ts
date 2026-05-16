/**
 * Workflow simulator — frontend execution engine mirroring backend
 * ApprovalWorkflowExecutorImpl.
 *
 * Sprint 3 Track-I (C-APPROVAL-EDITOR-1) Day 9.
 *
 * Pure-TypeScript engine (no UI deps) so we can:
 *   1) Drive the WorkflowSimulator.vue component
 *   2) Vitest-parity-test against the Java backend's 11 unit tests
 *
 * Mirrors backend semantics 1:1 (key parity guarantees):
 *   - Sequential / Parallel / Conditional / Join 4 modes
 *   - SpEL condition eval via lib/spel.ts (same operators backend uses)
 *   - 会签 N-of-N: approval node with requiredApprovers ≥ 2 stays active
 *     until cumulative APPROVED count meets threshold
 *   - Join modes: ALL (all incoming sources arrived) / N_OF_M (size ≥ n)
 *     / ANY (size ≥ 1)
 *   - Auto-approve / auto-reject SpEL on approval node
 *   - REJECTED beats APPROVED on concurrent terminating branches
 *   - Cancel sets status=CANCELLED
 *
 * Out of scope (Sprint 4 follow-up): persistent ExecutionContext,
 * timeout escalation, audit trail to backend.
 *
 * @since 2026-05-16
 */
import { evaluateSpel } from '../lib/spel'
import type {
  ApprovalWorkflowEdge,
  ApprovalWorkflowNode,
  NodeType,
} from '@/api/approvalWorkflow'

export type SimStatus = 'RUNNING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'TIMEOUT'
export type SimDecision = 'APPROVED' | 'REJECTED'

export interface SimApprovalRecord {
  nodeId: string
  decision?: SimDecision
  approverUserId?: number
  approverRole?: string
  comment?: string
  /** Marker record for join arrivals (no decision; comment carries source). */
  joinArrivalFrom?: string
}

export interface SimExecutionContext {
  workflowId: string
  decisionType: string
  startNodeId: string
  businessContext: Record<string, unknown>
  activeNodeIds: Set<string>
  nodeHistory: Map<string, SimApprovalRecord[]>
  joinArrivals: Map<string, Set<string>>
  status: SimStatus
  finalOutcome?: string
  cancelReason?: string
}

export interface SimulatorInput {
  workflowId?: string
  decisionType?: string
  startNodeId: string
  nodes: ApprovalWorkflowNode[]
  edges: ApprovalWorkflowEdge[]
}

interface GraphIndex {
  nodesById: Map<string, ApprovalWorkflowNode>
  outgoingByNode: Map<string, ApprovalWorkflowEdge[]>
  incomingByNode: Map<string, ApprovalWorkflowEdge[]>
}

function indexGraph(input: SimulatorInput): GraphIndex {
  const nodesById = new Map<string, ApprovalWorkflowNode>()
  for (const n of input.nodes) nodesById.set(n.id, n)
  const outgoingByNode = new Map<string, ApprovalWorkflowEdge[]>()
  const incomingByNode = new Map<string, ApprovalWorkflowEdge[]>()
  for (const e of input.edges) {
    if (!outgoingByNode.has(e.source)) outgoingByNode.set(e.source, [])
    outgoingByNode.get(e.source)!.push(e)
    if (!incomingByNode.has(e.target)) incomingByNode.set(e.target, [])
    incomingByNode.get(e.target)!.push(e)
  }
  return { nodesById, outgoingByNode, incomingByNode }
}

function getInt(config: Record<string, unknown> | undefined, key: string, def: number): number {
  const v = config?.[key]
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isNaN(n) ? def : n
  }
  return def
}

function countApprovedAt(ctx: SimExecutionContext, nodeId: string): number {
  const recs = ctx.nodeHistory.get(nodeId) ?? []
  return recs.filter(r => r.decision === 'APPROVED').length
}

function recordApproval(ctx: SimExecutionContext, rec: SimApprovalRecord) {
  if (!ctx.nodeHistory.has(rec.nodeId)) ctx.nodeHistory.set(rec.nodeId, [])
  ctx.nodeHistory.get(rec.nodeId)!.push(rec)
}

function terminate(ctx: SimExecutionContext, status: SimStatus, outcome: string) {
  // REJECTED beats APPROVED if a prior parallel branch already terminated REJECTED
  if (ctx.status === 'REJECTED' && status === 'APPROVED') return
  ctx.status = status
  ctx.finalOutcome = outcome
  ctx.activeNodeIds.clear()
}

function advance(
  ctx: SimExecutionContext,
  graph: GraphIndex,
  nodeId: string,
  fromSourceNodeId: string | null,
) {
  if (ctx.status !== 'RUNNING') return
  const node = graph.nodesById.get(nodeId)
  if (!node) {
    terminate(ctx, 'REJECTED', 'GRAPH_ERROR')
    return
  }

  switch (node.type as NodeType) {
    case 'start': {
      const outgoing = graph.outgoingByNode.get(nodeId) ?? []
      if (outgoing.length === 0) {
        terminate(ctx, 'REJECTED', 'START_NO_OUTGOING')
        return
      }
      advance(ctx, graph, outgoing[0].target, nodeId)
      break
    }
    case 'approval': {
      activateApproval(ctx, graph, nodeId, node)
      break
    }
    case 'condition': {
      advanceFromCondition(ctx, graph, nodeId)
      break
    }
    case 'parallel': {
      const outgoing = graph.outgoingByNode.get(nodeId) ?? []
      if (outgoing.length === 0) {
        terminate(ctx, 'REJECTED', 'PARALLEL_NO_OUTGOING')
        return
      }
      for (const e of outgoing) advance(ctx, graph, e.target, nodeId)
      break
    }
    case 'join': {
      arriveAtJoin(ctx, graph, nodeId, fromSourceNodeId)
      break
    }
    case 'notify': {
      // fire-and-forget: continue
      for (const e of graph.outgoingByNode.get(nodeId) ?? []) {
        advance(ctx, graph, e.target, nodeId)
      }
      break
    }
    case 'end': {
      const outcome = String(node.config?.outcome ?? 'APPROVED')
      const status: SimStatus =
        outcome === 'REJECTED' ? 'REJECTED'
        : outcome === 'TIMEOUT' ? 'TIMEOUT'
        : outcome === 'CANCELLED' ? 'CANCELLED'
        : 'APPROVED'
      terminate(ctx, status, outcome)
      break
    }
    default: {
      terminate(ctx, 'REJECTED', 'UNKNOWN_NODE_TYPE')
    }
  }
}

function activateApproval(
  ctx: SimExecutionContext,
  graph: GraphIndex,
  nodeId: string,
  node: ApprovalWorkflowNode,
) {
  const autoApprove = String(node.config?.autoApproveCondition ?? '')
  if (autoApprove && evaluateSpel(autoApprove, ctx.businessContext)) {
    const required = getInt(node.config, 'requiredApprovers', 1)
    for (let i = 0; i < required; i++) {
      recordApproval(ctx, {
        nodeId,
        decision: 'APPROVED',
        comment: `AUTO_APPROVE:${autoApprove}`,
      })
    }
    for (const e of graph.outgoingByNode.get(nodeId) ?? []) {
      advance(ctx, graph, e.target, nodeId)
    }
    return
  }
  const autoReject = String(node.config?.autoRejectCondition ?? '')
  if (autoReject && evaluateSpel(autoReject, ctx.businessContext)) {
    recordApproval(ctx, {
      nodeId,
      decision: 'REJECTED',
      comment: `AUTO_REJECT:${autoReject}`,
    })
    terminate(ctx, 'REJECTED', 'REJECTED')
    return
  }
  // Otherwise wait for human submit
  ctx.activeNodeIds.add(nodeId)
}

function advanceFromCondition(ctx: SimExecutionContext, graph: GraphIndex, nodeId: string) {
  const outgoing = (graph.outgoingByNode.get(nodeId) ?? []).slice()
  // Sort by priority ASC (smaller = earlier eval)
  outgoing.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
  let defaultEdge: ApprovalWorkflowEdge | null = null
  for (const e of outgoing) {
    if ((e.label ?? '').toUpperCase() === 'DEFAULT') {
      defaultEdge = e
      continue
    }
    if (!e.condition || !e.condition.trim()) {
      // empty condition = always true
      advance(ctx, graph, e.target, nodeId)
      return
    }
    if (evaluateSpel(e.condition, ctx.businessContext)) {
      advance(ctx, graph, e.target, nodeId)
      return
    }
  }
  if (defaultEdge) {
    advance(ctx, graph, defaultEdge.target, nodeId)
    return
  }
  terminate(ctx, 'REJECTED', 'CONDITION_NO_MATCH')
}

function arriveAtJoin(
  ctx: SimExecutionContext,
  graph: GraphIndex,
  joinNodeId: string,
  fromSourceNodeId: string | null,
) {
  const node = graph.nodesById.get(joinNodeId)!
  if (fromSourceNodeId) {
    if (!ctx.joinArrivals.has(joinNodeId)) ctx.joinArrivals.set(joinNodeId, new Set())
    ctx.joinArrivals.get(joinNodeId)!.add(fromSourceNodeId)
    recordApproval(ctx, { nodeId: joinNodeId, joinArrivalFrom: fromSourceNodeId, comment: `JOIN_ARRIVAL_FROM:${fromSourceNodeId}` })
  }
  const mode = String(node.config?.mode ?? 'ALL')
  let ready = false
  if (mode === 'ALL') {
    const incomingSources = new Set((graph.incomingByNode.get(joinNodeId) ?? []).map(e => e.source))
    const arrived = ctx.joinArrivals.get(joinNodeId) ?? new Set()
    ready = [...incomingSources].every(s => arrived.has(s))
  } else if (mode === 'N_OF_M') {
    const n = getInt(node.config, 'n', Number.MAX_SAFE_INTEGER)
    ready = (ctx.joinArrivals.get(joinNodeId)?.size ?? 0) >= n
  } else if (mode === 'ANY') {
    ready = (ctx.joinArrivals.get(joinNodeId)?.size ?? 0) >= 1
  }

  if (!ready) return
  for (const e of graph.outgoingByNode.get(joinNodeId) ?? []) {
    advance(ctx, graph, e.target, joinNodeId)
  }
}

// ==================== Public API ====================

/**
 * Start a workflow simulation. Returns ExecutionContext paused at first
 * approval node, or already terminal if auto-advanced through.
 */
export function startSimulation(
  input: SimulatorInput,
  businessContext: Record<string, unknown> = {},
): SimExecutionContext {
  const ctx: SimExecutionContext = {
    workflowId: input.workflowId ?? 'sim',
    decisionType: input.decisionType ?? 'CUSTOM',
    startNodeId: input.startNodeId,
    businessContext: { ...businessContext },
    activeNodeIds: new Set(),
    nodeHistory: new Map(),
    joinArrivals: new Map(),
    status: 'RUNNING',
  }
  const graph = indexGraph(input)
  advance(ctx, graph, input.startNodeId, null)
  return ctx
}

/**
 * Submit a decision at an active approval node.
 * - REJECTED → terminates whole context with status=REJECTED.
 * - APPROVED → counts; if requiredApprovers met, advances outgoing.
 */
export function submitDecision(
  ctx: SimExecutionContext,
  input: SimulatorInput,
  nodeId: string,
  decision: SimDecision,
  meta?: { approverUserId?: number; approverRole?: string; comment?: string },
): SimExecutionContext {
  if (ctx.status !== 'RUNNING') {
    throw new Error(`Cannot submit on terminated context (status=${ctx.status})`)
  }
  if (!ctx.activeNodeIds.has(nodeId)) {
    throw new Error(`Node ${nodeId} is not active`)
  }
  const graph = indexGraph(input)
  const node = graph.nodesById.get(nodeId)
  if (!node || node.type !== 'approval') {
    throw new Error(`Node ${nodeId} is not approval type`)
  }
  recordApproval(ctx, { nodeId, decision, ...meta })

  if (decision === 'REJECTED') {
    terminate(ctx, 'REJECTED', 'REJECTED')
    return ctx
  }

  const required = getInt(node.config, 'requiredApprovers', 1)
  if (countApprovedAt(ctx, nodeId) < required) {
    // co-sign in progress; keep node active
    return ctx
  }
  ctx.activeNodeIds.delete(nodeId)
  for (const e of graph.outgoingByNode.get(nodeId) ?? []) {
    advance(ctx, graph, e.target, nodeId)
  }
  return ctx
}

export function cancelSimulation(ctx: SimExecutionContext, reason: string): SimExecutionContext {
  if (ctx.status !== 'RUNNING') throw new Error(`Cannot cancel terminated context`)
  ctx.cancelReason = reason
  terminate(ctx, 'CANCELLED', 'CANCELLED')
  return ctx
}

/**
 * Convenience for testing: drive a workflow to completion by a scripted
 * sequence of decisions, mirroring the backend's submit() loop.
 *
 * Each step: pick the first active approval node matching `step.nodeIdOrPredicate`
 * (string id, or function), submit `step.decision`.
 *
 * Use when there's only one active approval per step (typical sequential
 * & conditional cases). For parallel branches, prefer scripted submits in
 * test order with explicit nodeIds.
 */
export function driveToCompletion(
  input: SimulatorInput,
  businessContext: Record<string, unknown>,
  decisions: Array<{ nodeId: string; decision: SimDecision; meta?: { approverUserId?: number; approverRole?: string; comment?: string } }>,
): SimExecutionContext {
  const ctx = startSimulation(input, businessContext)
  for (const step of decisions) {
    if (ctx.status !== 'RUNNING') break
    submitDecision(ctx, input, step.nodeId, step.decision, step.meta)
  }
  return ctx
}
