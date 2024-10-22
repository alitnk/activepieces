import { performance } from 'node:perf_hooks'
import { Action, ActionType, debounce, ExecuteFlowOperation, ExecutionType, isNil, WebsocketClientEvent } from '@activepieces/shared'
import { triggerHelper } from '../helper/trigger-helper'
import { progressService } from '../services/progress.service'
import { BaseExecutor } from './base-executor'
import { branchExecutor } from './branch-executor'
import { codeExecutor } from './code-executor'
import { EngineConstants } from './context/engine-constants'
import { ExecutionVerdict, FlowExecutorContext } from './context/flow-execution-context'
import { loopExecutor } from './loop-executor'
import { pieceExecutor } from './piece-executor'

const executeFunction: Record<ActionType, BaseExecutor<Action>> = {
    [ActionType.CODE]: codeExecutor,
    [ActionType.BRANCH]: branchExecutor,
    [ActionType.LOOP_ON_ITEMS]: loopExecutor,
    [ActionType.PIECE]: pieceExecutor,
}

export const flowExecutor = {
    getExecutorForAction(type: ActionType): BaseExecutor<Action> {
        const executor = executeFunction[type]
        if (isNil(executor)) {
            throw new Error('Not implemented')
        }
        return executor
    },
    async executeFromTrigger({ executionState, constants, input }: {
        executionState: FlowExecutorContext
        constants: EngineConstants
        input: ExecuteFlowOperation
    }): Promise<FlowExecutorContext> {
        const trigger = input.flowVersion.trigger
        if (input.executionType === ExecutionType.BEGIN) {
            await triggerHelper.executeOnStart(trigger, constants, input.triggerPayload)
        }
        progressService.sendUpdate({
            engineConstants: constants,
            flowExecutorContext: executionState,
        }).catch(error => {
            console.error('Error sending update:', error)
        })

        const flowExecutionPromise = flowExecutor.execute({
            action: trigger.nextAction,
            executionState,
            constants,
        })

        progressService.sendUpdate({
            engineConstants: constants,
            flowExecutorContext: executionState,
        }).catch(error => {
            console.error('Error sending update:', error)
        })

        return flowExecutionPromise
    },
    async execute({ action, constants, executionState }: {
        action: Action
        executionState: FlowExecutorContext
        constants: EngineConstants
    }): Promise<FlowExecutorContext> {
        const flowStartTime = performance.now()
        let flowExecutionContext = executionState
        let currentAction: Action | undefined = action
        let lastActionExecutionTime = performance.now()

        while (!isNil(currentAction)) {
            const handler = this.getExecutorForAction(currentAction.type)

            const stepStartTime = performance.now()
            progressService.sendUpdate({
                engineConstants: constants,
                flowExecutorContext: flowExecutionContext,
                lastActionExecutionTime,
            }).catch(error => {
                console.error('Error sending update:', error)
            })

            flowExecutionContext = await handler.handle({
                action: currentAction,
                executionState: flowExecutionContext,
                constants,
            })
            const stepEndTime = performance.now()
            lastActionExecutionTime = stepEndTime
            flowExecutionContext = flowExecutionContext.setStepDuration({
                stepName: currentAction.name,
                duration: stepEndTime - stepStartTime,
            })

            if (flowExecutionContext.verdict !== ExecutionVerdict.RUNNING) {
                break
            }

            currentAction = currentAction.nextAction
        }

        const flowEndTime = performance.now()
        return flowExecutionContext.setDuration(flowEndTime - flowStartTime)
    },
}
