import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import FlowProgressDock from '../FlowProgressDock'

function renderDock(overrides?: Partial<ComponentProps<typeof FlowProgressDock>>) {
  const props: ComponentProps<typeof FlowProgressDock> = {
    selfieCount: 0,
    hasUneditedFields: false,
    hasEnoughCredits: true,
    currentStep: 'selfies',
    onNavigateToPreviousStep: jest.fn(),
    onNavigateToSelfieStep: jest.fn(),
    onNavigateToCustomize: jest.fn(),
    onGenerate: jest.fn(),
    ...overrides,
  }

  return {
    ...render(<FlowProgressDock {...props} />),
    props,
  }
}

describe('FlowProgressDock beautification flow navigation', () => {
  it('keeps continue disabled on selfies step until required selfie count is met', async () => {
    const { props } = renderDock({ selfieCount: 1, requiredSelfies: 2, currentStep: 'selfies' })

    const continueButton = await waitFor(() =>
      screen.getByRole('button', { name: 'navigation.beautification' })
    )

    expect((continueButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(continueButton)
    expect(props.onNavigateToCustomize).not.toHaveBeenCalled()
  })

  it('routes selfies continue action to beautification target callback', async () => {
    const { props } = renderDock({ selfieCount: 2, requiredSelfies: 2, currentStep: 'selfies' })

    const continueButton = await waitFor(() =>
      screen.getByRole('button', { name: 'navigation.beautification' })
    )

    fireEvent.click(continueButton)
    expect(props.onNavigateToCustomize).toHaveBeenCalledTimes(1)
  })

  it('wires beautification back and continue actions correctly', async () => {
    const { props } = renderDock({ selfieCount: 3, currentStep: 'beautification' })

    const backButton = await waitFor(() =>
      screen.getByRole('button', { name: 'navigation.selfies' })
    )
    const continueButton = screen.getByRole('button', { name: 'navigation.customize' })

    fireEvent.click(backButton)
    fireEvent.click(continueButton)

    expect(props.onNavigateToPreviousStep).toHaveBeenCalledTimes(1)
    expect(props.onNavigateToCustomize).toHaveBeenCalledTimes(1)
  })

  it('shows detailed sequence with beautification step and arrows', async () => {
    renderDock({
      selfieCount: 3,
      currentStep: 'customize',
      customizationStepsMeta: {
        editableSteps: 3,
        allSteps: 3,
        lockedSteps: [],
      },
      visitedEditableSteps: [0, 1],
    })

    const expandButton = await waitFor(() =>
      screen.getByRole('button', { name: 'navigation.expand' })
    )
    fireEvent.click(expandButton)

    expect(screen.getByTestId('flow-dock-detail-step-selfies')).toBeInTheDocument()
    expect(screen.getByTestId('flow-dock-detail-step-beautification')).toBeInTheDocument()
    expect(screen.getByTestId('flow-dock-detail-step-customize')).toBeInTheDocument()
    expect(screen.getByTestId('flow-dock-detail-arrow-1')).toBeInTheDocument()
    expect(screen.getByTestId('flow-dock-detail-arrow-2')).toBeInTheDocument()
    expect(screen.getByTestId('flow-dock-detail-arrow-3')).toBeInTheDocument()
    expect(screen.getByTestId('flow-dock-detail-finish')).toBeInTheDocument()
  })

  it('uses a smaller generate button when ready to finish', async () => {
    renderDock({
      selfieCount: 3,
      currentStep: 'customize',
      customizationStepsMeta: {
        editableSteps: 0,
        allSteps: 0,
        lockedSteps: [],
      },
      visitedEditableSteps: [],
      hasEnoughCredits: true,
    })

    const generateButton = await waitFor(() => screen.getByTestId('flow-dock-generate-button'))
    expect(generateButton.className).toContain('h-8')
    expect(generateButton.className).toContain('text-xs')
  })
})
