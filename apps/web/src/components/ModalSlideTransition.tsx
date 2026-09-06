import * as React from 'react'
import { Transition } from 'react-transition-group'
import type { TransitionProps } from '@mui/material/transitions'

/**
 * Professional Modal Motion Constants
 * Silky-smooth, directional bottom-sheet motion (Opening: slide up -> 0, Closing: 0 -> slide down)
 */
export const MODAL_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'
export const MODAL_ENTER_DURATION = 300
export const MODAL_EXIT_DURATION = 220
export const BACKDROP_FADE_DURATION = 180

export type DeviceMotionTier = 'high' | 'low' | 'reduced'

export interface DeviceMotionProfile {
  tier: DeviceMotionTier
  enterDuration: number
  exitDuration: number
  easing: string
}

function checkReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Dynamically detects device performance tier to tailor transition curves.
 * Low-spec devices (<=4 cores, <=4GB RAM) receive lighter, snappy transitions to eliminate dropped frames.
 */
export function getDeviceMotionProfile(): DeviceMotionProfile {
  if (typeof window === 'undefined') {
    return {
      tier: 'high',
      enterDuration: MODAL_ENTER_DURATION,
      exitDuration: MODAL_EXIT_DURATION,
      easing: MODAL_EASING,
    }
  }

  // 1. Accessibility check
  if (checkReducedMotion()) {
    return {
      tier: 'reduced',
      enterDuration: 120,
      exitDuration: 100,
      easing: 'linear',
    }
  }

  // 2. Hardware constraints check (standard navigator.hardwareConcurrency)
  const isLowTier = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 4) <= 4

  if (isLowTier) {
    return {
      tier: 'low',
      enterDuration: 220,
      exitDuration: 170,
      easing: 'cubic-bezier(0, 0, 0.2, 1)',
    }
  }

  return {
    tier: 'high',
    enterDuration: MODAL_ENTER_DURATION,
    exitDuration: MODAL_EXIT_DURATION,
    easing: MODAL_EASING,
  }
}

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 600
}

/**
 * Reusable Universal Modal Bottom Sheet Transition for Dialogs & Modals.
 *
 * Mobile (Bottom Sheet):
 *   Entrance: translate3d(0, 100%, 0) -> translate3d(0, 0, 0), opacity: 0 -> 1
 *   Exit:     translate3d(0, 0, 0) -> translate3d(0, 100%, 0), opacity: 1 -> 0
 *
 * Desktop/Tablet (Elevated Sheet):
 *   Entrance: translate3d(0, 36px, 0) scale(0.98) -> translate3d(0, 0, 0) scale(1), opacity: 0 -> 1
 *   Exit:     translate3d(0, 0, 0) scale(1) -> translate3d(0, 36px, 0) scale(0.98), opacity: 1 -> 0
 */
export const ModalSlideTransition = React.forwardRef<
  HTMLDivElement,
  TransitionProps & { children: React.ReactElement<any, any> }
>(function ModalSlideTransition(props, ref) {
  const {
    children,
    in: inProp,
    onEnter,
    onEntering,
    onEntered,
    onExit,
    onExiting,
    onExited,
    addEndListener,
    timeout,
    ...other
  } = props

  const nodeRef = React.useRef<HTMLDivElement | null>(null)

  // Fork ref between nodeRef and forwarded ref
  const handleRef = (node: HTMLDivElement | null) => {
    nodeRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref && 'current' in ref) {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    }
  }

  const handleEnter = (isAppearing?: boolean) => {
    const node = nodeRef.current
    if (!node) return

    const motion = getDeviceMotionProfile()
    const isMobile = isMobileViewport()

    if (motion.tier === 'reduced') {
      node.style.opacity = '1'
      node.style.transform = 'none'
      node.style.transition = 'none'
    } else {
      node.style.opacity = '0'
      node.style.transform = isMobile
        ? 'translate3d(0, 100%, 0)'
        : 'translate3d(0, 36px, 0) scale(0.98)'
      node.style.transition = 'none'
      node.style.willChange = 'transform, opacity'
    }

    if (onEnter) {
      onEnter(node, isAppearing ?? false)
    }
  }

  const handleEntering = (isAppearing?: boolean) => {
    const node = nodeRef.current
    if (!node) return

    const motion = getDeviceMotionProfile()

    // Force DOM reflow to guarantee transition triggers cleanly from initial values
    void node.offsetHeight

    if (motion.tier !== 'reduced') {
      node.style.transition = `opacity ${Math.round(motion.enterDuration * 0.7)}ms ease, transform ${motion.enterDuration}ms ${motion.easing}`
      node.style.opacity = '1'
      node.style.transform = 'translate3d(0, 0, 0) scale(1)'
    }

    if (onEntering) {
      onEntering(node, isAppearing ?? false)
    }
  }

  const handleEntered = (isAppearing?: boolean) => {
    const node = nodeRef.current
    if (node) {
      node.style.opacity = '1'
      node.style.transform = 'none'
      node.style.transition = ''
      node.style.willChange = 'auto'
      if (onEntered) {
        onEntered(node, isAppearing ?? false)
      }
    }
  }

  const handleExit = () => {
    const node = nodeRef.current
    if (!node) return

    const motion = getDeviceMotionProfile()
    if (motion.tier !== 'reduced') {
      node.style.opacity = '1'
      node.style.transform = 'translate3d(0, 0, 0) scale(1)'
      node.style.willChange = 'transform, opacity'
    }

    if (onExit) {
      onExit(node)
    }
  }

  const handleExiting = () => {
    const node = nodeRef.current
    if (!node) return

    const motion = getDeviceMotionProfile()
    const isMobile = isMobileViewport()

    void node.offsetHeight

    if (motion.tier !== 'reduced') {
      node.style.transition = `opacity ${motion.exitDuration}ms ease, transform ${motion.exitDuration}ms ${motion.easing}`
      node.style.opacity = '0'
      node.style.transform = isMobile
        ? 'translate3d(0, 100%, 0)'
        : 'translate3d(0, 36px, 0) scale(0.98)'
    } else {
      node.style.opacity = '0'
      node.style.transition = 'none'
    }

    if (onExiting) {
      onExiting(node)
    }
  }

  const handleExited = () => {
    const node = nodeRef.current
    if (node) {
      node.style.opacity = ''
      node.style.transform = ''
      node.style.transition = ''
      node.style.willChange = 'auto'
      if (onExited) {
        onExited(node)
      }
    }
  }

  const effectiveTimeout = timeout ?? {
    enter: MODAL_ENTER_DURATION,
    exit: MODAL_EXIT_DURATION,
  }

  return (
    <Transition
      nodeRef={nodeRef}
      in={inProp}
      timeout={effectiveTimeout}
      onEnter={handleEnter}
      onEntering={handleEntering}
      onEntered={handleEntered}
      onExit={handleExit}
      onExiting={handleExiting}
      onExited={handleExited}
      {...(addEndListener
        ? {
            addEndListener: (done: () => void) => {
              if (nodeRef.current) addEndListener(nodeRef.current, done)
              else done()
            },
          }
        : {})}
      {...other}
    >
      {(_state: any, childProps: any) => {
        return React.cloneElement(children, {
          ref: handleRef,
          ...childProps,
        })
      }}
    </Transition>
  )
})

