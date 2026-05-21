import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePassiveResumeToast } from '../hooks/usePassiveResumeToast'

describe('usePassiveResumeToast', () => {
  let visibilityState: DocumentVisibilityState

  beforeEach(() => {
    vi.clearAllMocks()
    visibilityState = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    })
  })

  function emitVisibility(state: DocumentVisibilityState): void {
    visibilityState = state
    document.dispatchEvent(new Event('visibilitychange'))
  }

  it('does not notify for quick tab switches', () => {
    const onPassiveResume = vi.fn()
    let nowMs = 0

    renderHook(() =>
      usePassiveResumeToast({
        onPassiveResume,
        minHiddenDurationMs: 10 * 60 * 1000,
        now: () => nowMs,
      }),
    )

    act(() => {
      emitVisibility('hidden')
      nowMs = 2 * 60 * 1000
      emitVisibility('visible')
    })

    expect(onPassiveResume).not.toHaveBeenCalled()
  })

  it('does not notify while disabled', () => {
    const onPassiveResume = vi.fn()
    let nowMs = 0

    renderHook(() =>
      usePassiveResumeToast({
        enabled: false,
        onPassiveResume,
        minHiddenDurationMs: 10 * 60 * 1000,
        now: () => nowMs,
      }),
    )

    act(() => {
      emitVisibility('hidden')
      nowMs = 12 * 60 * 1000
      emitVisibility('visible')
    })

    expect(onPassiveResume).not.toHaveBeenCalled()
  })

  it('notifies once after meaningful hidden duration', () => {
    const onPassiveResume = vi.fn()
    let nowMs = 0

    renderHook(() =>
      usePassiveResumeToast({
        onPassiveResume,
        minHiddenDurationMs: 10 * 60 * 1000,
        now: () => nowMs,
      }),
    )

    act(() => {
      emitVisibility('hidden')
      nowMs = 10 * 60 * 1000
      emitVisibility('visible')
    })

    expect(onPassiveResume).toHaveBeenCalledTimes(1)
    expect(onPassiveResume).toHaveBeenCalledWith(10 * 60 * 1000)
  })

  it('suppresses duplicate passive notifications during rapid churn', () => {
    const onPassiveResume = vi.fn()
    let nowMs = 0

    renderHook(() =>
      usePassiveResumeToast({
        onPassiveResume,
        minHiddenDurationMs: 10 * 60 * 1000,
        cooldownMs: 60 * 1000,
        now: () => nowMs,
      }),
    )

    act(() => {
      emitVisibility('hidden')
      nowMs = 10 * 60 * 1000
      emitVisibility('visible')
      emitVisibility('hidden')
      nowMs = 10 * 60 * 1000 + 30 * 1000
      emitVisibility('visible')
    })

    expect(onPassiveResume).toHaveBeenCalledTimes(1)
  })
})
