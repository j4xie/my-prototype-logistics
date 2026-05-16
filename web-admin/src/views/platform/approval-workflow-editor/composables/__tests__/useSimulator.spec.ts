/**
 * useSimulator parity tests — 10 mock cases matching backend
 * ApprovalWorkflowExecutorImplTest.java semantics.
 *
 * Sprint 3 Track-I (C-APPROVAL-EDITOR-1) Day 9 gate: ≥ 10 cases
 * passing same business outcome as backend executor.
 *
 * Cross-referenced to backend test file:
 *   backend/java/cretas-api/src/test/java/com/cretas/aims/service/workflow/impl/
 *   ApprovalWorkflowExecutorImplTest.java
 *
 * @since 2026-05-16
 */
import { describe, expect, it } from 'vitest'
import type { ApprovalWorkflowEdge, ApprovalWorkflowNode } from '@/api/approvalWorkflow'
import {
  cancelSimulation,
  driveToCompletion,
  startSimulation,
  submitDecision,
  type SimulatorInput,
} from '../useSimulator'

function makeNode(
  id: string,
  type: ApprovalWorkflowNode['type'],
  config: Record<string, unknown> = {},
): ApprovalWorkflowNode {
  return { id, type, label: id, position: { x: 0, y: 0 }, config }
}

function makeEdge(id: string, source: string, target: string, opts: Partial<ApprovalWorkflowEdge> = {}): ApprovalWorkflowEdge {
  return {
    id,
    source,
    target,
    condition: opts.condition,
    label: opts.label,
    priority: opts.priority ?? 0,
  }
}

function approvalConfig(requiredApprovers: number, roles: string[] = []) {
  return { requiredApprovers, approverRoles: roles }
}

describe('useSimulator — parity with backend ApprovalWorkflowExecutorImpl', () => {
  it('Case 1: Sequential 1-step APPROVED → status=APPROVED', () => {
    const input: SimulatorInput = {
      startNodeId: 'start',
      nodes: [
        makeNode('start', 'start'),
        makeNode('approve1', 'approval', approvalConfig(1, ['factory_admin'])),
        makeNode('end_ok', 'end', { outcome: 'APPROVED' }),
      ],
      edges: [
        makeEdge('e1', 'start', 'approve1'),
        makeEdge('e2', 'approve1', 'end_ok'),
      ],
    }
    const ctx = driveToCompletion(input, {}, [{ nodeId: 'approve1', decision: 'APPROVED' }])
    expect(ctx.status).toBe('APPROVED')
    expect(ctx.finalOutcome).toBe('APPROVED')
  })

  it('Case 2: Sequential 1-step REJECTED → status=REJECTED', () => {
    const input: SimulatorInput = {
      startNodeId: 'start',
      nodes: [
        makeNode('start', 'start'),
        makeNode('approve1', 'approval', approvalConfig(1, ['factory_admin'])),
        makeNode('end_ok', 'end', { outcome: 'APPROVED' }),
      ],
      edges: [makeEdge('e1', 'start', 'approve1'), makeEdge('e2', 'approve1', 'end_ok')],
    }
    const ctx = driveToCompletion(input, {}, [{ nodeId: 'approve1', decision: 'REJECTED' }])
    expect(ctx.status).toBe('REJECTED')
    expect(ctx.finalOutcome).toBe('REJECTED')
  })

  it('Case 3: Sequential 3-step all APPROVED', () => {
    const input: SimulatorInput = {
      startNodeId: 'start',
      nodes: [
        makeNode('start', 'start'),
        makeNode('a', 'approval', approvalConfig(1)),
        makeNode('b', 'approval', approvalConfig(1)),
        makeNode('c', 'approval', approvalConfig(1)),
        makeNode('end_ok', 'end', { outcome: 'APPROVED' }),
      ],
      edges: [
        makeEdge('e1', 'start', 'a'),
        makeEdge('e2', 'a', 'b'),
        makeEdge('e3', 'b', 'c'),
        makeEdge('e4', 'c', 'end_ok'),
      ],
    }
    const ctx = driveToCompletion(input, {}, [
      { nodeId: 'a', decision: 'APPROVED' },
      { nodeId: 'b', decision: 'APPROVED' },
      { nodeId: 'c', decision: 'APPROVED' },
    ])
    expect(ctx.status).toBe('APPROVED')
  })

  it('Case 4: Conditional amount > 10000 → high branch', () => {
    const input: SimulatorInput = {
      startNodeId: 'start',
      nodes: [
        makeNode('start', 'start'),
        makeNode('check', 'condition'),
        makeNode('approve_high', 'approval', approvalConfig(1)),
        makeNode('approve_low', 'approval', approvalConfig(1)),
        makeNode('end_ok', 'end', { outcome: 'APPROVED' }),
      ],
      edges: [
        makeEdge('e1', 'start', 'check'),
        makeEdge('e_hi', 'check', 'approve_high', { condition: '#amount > 10000', priority: 0 }),
        makeEdge('e_lo', 'check', 'approve_low', { priority: 1 }), // no condition = fallback path
        makeEdge('e_hi_end', 'approve_high', 'end_ok'),
        makeEdge('e_lo_end', 'approve_low', 'end_ok'),
      ],
    }
    const ctx = startSimulation(input, { amount: 15000 })
    expect(ctx.activeNodeIds.has('approve_high')).toBe(true)
    submitDecision(ctx, input, 'approve_high', 'APPROVED')
    expect(ctx.status).toBe('APPROVED')
  })

  it('Case 5: Conditional amount <= 10000 → low branch (fallback)', () => {
    const input: SimulatorInput = {
      startNodeId: 'start',
      nodes: [
        makeNode('start', 'start'),
        makeNode('check', 'condition'),
        makeNode('approve_high', 'approval', approvalConfig(1)),
        makeNode('approve_low', 'approval', approvalConfig(1)),
        makeNode('end_ok', 'end', { outcome: 'APPROVED' }),
      ],
      edges: [
        makeEdge('e1', 'start', 'check'),
        makeEdge('e_hi', 'check', 'approve_high', { condition: '#amount > 10000', priority: 0 }),
        makeEdge('e_lo', 'check', 'approve_low', { priority: 1 }),
        makeEdge('e_hi_end', 'approve_high', 'end_ok'),
        makeEdge('e_lo_end', 'approve_low', 'end_ok'),
      ],
    }
    const ctx = startSimulation(input, { amount: 5000 })
    expect(ctx.activeNodeIds.has('approve_low')).toBe(true)
  })

  it('Case 6: Parallel + Join ALL: 2 branches both APPROVED → end', () => {
    const input: SimulatorInput = {
      startNodeId: 'start',
      nodes: [
        makeNode('start', 'start'),
        makeNode('par', 'parallel'),
        makeNode('br_a', 'approval', approvalConfig(1)),
        makeNode('br_b', 'approval', approvalConfig(1)),
        makeNode('join', 'join', { mode: 'ALL' }),
        makeNode('end_ok', 'end', { outcome: 'APPROVED' }),
      ],
      edges: [
        makeEdge('e1', 'start', 'par'),
        makeEdge('ea', 'par', 'br_a'),
        makeEdge('eb', 'par', 'br_b'),
        makeEdge('eaj', 'br_a', 'join'),
        makeEdge('ebj', 'br_b', 'join'),
        makeEdge('eend', 'join', 'end_ok'),
      ],
    }
    const ctx = startSimulation(input, {})
    expect(ctx.activeNodeIds.has('br_a') && ctx.activeNodeIds.has('br_b')).toBe(true)
    submitDecision(ctx, input, 'br_a', 'APPROVED')
    expect(ctx.status).toBe('RUNNING')
    submitDecision(ctx, input, 'br_b', 'APPROVED')
    expect(ctx.status).toBe('APPROVED')
  })

  it('Case 7: Parallel + Join N_OF_M (2 of 3) → 2 APPROVED end', () => {
    const input: SimulatorInput = {
      startNodeId: 'start',
      nodes: [
        makeNode('start', 'start'),
        makeNode('par', 'parallel'),
        makeNode('br_a', 'approval', approvalConfig(1)),
        makeNode('br_b', 'approval', approvalConfig(1)),
        makeNode('br_c', 'approval', approvalConfig(1)),
        makeNode('join', 'join', { mode: 'N_OF_M', n: 2 }),
        makeNode('end_ok', 'end', { outcome: 'APPROVED' }),
      ],
      edges: [
        makeEdge('e1', 'start', 'par'),
        makeEdge('ea', 'par', 'br_a'),
        makeEdge('eb', 'par', 'br_b'),
        makeEdge('ec', 'par', 'br_c'),
        makeEdge('eaj', 'br_a', 'join'),
        makeEdge('ebj', 'br_b', 'join'),
        makeEdge('ecj', 'br_c', 'join'),
        makeEdge('eend', 'join', 'end_ok'),
      ],
    }
    const ctx = startSimulation(input, {})
    submitDecision(ctx, input, 'br_a', 'APPROVED')
    expect(ctx.status).toBe('RUNNING')
    submitDecision(ctx, input, 'br_b', 'APPROVED')
    expect(ctx.status).toBe('APPROVED')
  })

  it('Case 8: Parallel + Join ANY → first APPROVED wins', () => {
    const input: SimulatorInput = {
      startNodeId: 'start',
      nodes: [
        makeNode('start', 'start'),
        makeNode('par', 'parallel'),
        makeNode('br_a', 'approval', approvalConfig(1)),
        makeNode('br_b', 'approval', approvalConfig(1)),
        makeNode('join', 'join', { mode: 'ANY' }),
        makeNode('end_ok', 'end', { outcome: 'APPROVED' }),
      ],
      edges: [
        makeEdge('e1', 'start', 'par'),
        makeEdge('ea', 'par', 'br_a'),
        makeEdge('eb', 'par', 'br_b'),
        makeEdge('eaj', 'br_a', 'join'),
        makeEdge('ebj', 'br_b', 'join'),
        makeEdge('eend', 'join', 'end_ok'),
      ],
    }
    const ctx = startSimulation(input, {})
    submitDecision(ctx, input, 'br_a', 'APPROVED')
    expect(ctx.status).toBe('APPROVED')
  })

  it('Case 9: Auto-approve SpEL trusted=true → skip approver', () => {
    const input: SimulatorInput = {
      startNodeId: 'start',
      nodes: [
        makeNode('start', 'start'),
        makeNode('approve1', 'approval', {
          requiredApprovers: 1,
          approverRoles: ['manager'],
          autoApproveCondition: '#trusted == true',
        }),
        makeNode('end_ok', 'end', { outcome: 'APPROVED' }),
      ],
      edges: [makeEdge('e1', 'start', 'approve1'), makeEdge('e2', 'approve1', 'end_ok')],
    }
    const ctx = startSimulation(input, { trusted: true })
    expect(ctx.status).toBe('APPROVED')
    expect(ctx.activeNodeIds.size).toBe(0)
  })

  it('Case 10: Cancel mid-flow → status=CANCELLED, post-cancel submit throws', () => {
    const input: SimulatorInput = {
      startNodeId: 'start',
      nodes: [
        makeNode('start', 'start'),
        makeNode('approve1', 'approval', approvalConfig(1)),
        makeNode('end_ok', 'end', { outcome: 'APPROVED' }),
      ],
      edges: [makeEdge('e1', 'start', 'approve1'), makeEdge('e2', 'approve1', 'end_ok')],
    }
    const ctx = startSimulation(input, {})
    cancelSimulation(ctx, '客户撤回')
    expect(ctx.status).toBe('CANCELLED')
    expect(ctx.cancelReason).toBe('客户撤回')
    expect(() => submitDecision(ctx, input, 'approve1', 'APPROVED')).toThrow()
  })

  it('Case 11: 会签 requiredApprovers=2 → 1 still RUNNING, 2nd advances', () => {
    const input: SimulatorInput = {
      startNodeId: 'start',
      nodes: [
        makeNode('start', 'start'),
        makeNode('cosign', 'approval', approvalConfig(2, ['r1', 'r2'])),
        makeNode('end_ok', 'end', { outcome: 'APPROVED' }),
      ],
      edges: [makeEdge('e1', 'start', 'cosign'), makeEdge('e2', 'cosign', 'end_ok')],
    }
    const ctx = startSimulation(input, {})
    expect(ctx.activeNodeIds.has('cosign')).toBe(true)
    submitDecision(ctx, input, 'cosign', 'APPROVED', { approverUserId: 1, approverRole: 'r1' })
    expect(ctx.status).toBe('RUNNING')
    expect(ctx.activeNodeIds.has('cosign')).toBe(true)
    submitDecision(ctx, input, 'cosign', 'APPROVED', { approverUserId: 2, approverRole: 'r2' })
    expect(ctx.status).toBe('APPROVED')
  })
})
