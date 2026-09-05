import * as React from 'react'
import { Transition } from 'react-transition-group'
import type { TransitionProps } from '@mui/material/transitions'

/**
 * Professional Modal Motion Constants
 * Fast, deliberate, directional motion (Opening: -24px -> 0, Closing: 0 -> +24px)
 */
export const MODAL_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'
export const MODAL_ENTER_DURATION = 300
export const MODAL_EXIT_DURATION = 220
export const BACKDROP_FADE_DURATION = 180

function checkReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Reusable Professional Directional Slide Transition for Dialogs & Modals.
 *
 * Entrance:
 *   opacity: 0 -> 1
 *   translateY: -24px -> 0
 *   scale: 0.98 -> 1
 *   duration: 300ms
 *   easing: cubic-bezier(.16, 1, .3, 1)
 *
 * Exit:
 *   opacity: 1 -> 0
 *   translateY: 0 -> 24px
 *   scale: 1 -> 0.98
 *   duration: 220ms
 *   easing: cubic-bezier(.16, 1, .3, 1)
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
    timeout = { enter: MODAL_ENTER_DURATION, exit: MODAL_EXIT_DURATION },
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

    const reduced = checkReducedMotion()
    if (reduced) {
      node.style.opacity = '1'
      node.style.transform = 'none'
      node.style.transition = 'none'
    } else {
      node.style.opacity = '0'
      node.style.transform = 'translateY(-24px) scale(0.98)'
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

    const reduced = checkReducedMotion()
    // Force DOM reflow to guarantee transition triggers from initial values
    void node.offsetHeight

    if (!reduced) {
      node.style.transition = `opacity 220ms ease, transform ${MODAL_ENTER_DURATION}ms ${MODAL_EASING}`
      node.style.opacity = '1'
      node.style.transform = 'translateY(0) scale(1)'
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

    const reduced = checkReducedMotion()
    if (!reduced) {
      node.style.opacity = '1'
      node.style.transform = 'translateY(0) scale(1)'
      node.style.willChange = 'transform, opacity'
    }

    if (onExit) {
      onExit(node)
    }
  }

  const handleExiting = () => {
    const node = nodeRef.current
    if (!node) return

    const reduced = checkReducedMotion()
    void node.offsetHeight

    if (!reduced) {
      node.style.transition = `opacity 200ms ease, transform ${MODAL_EXIT_DURATION}ms ${MODAL_EASING}`
      node.style.opacity = '0'
      node.style.transform = 'translateY(24px) scale(0.98)'
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

  return (
    <Transition
      nodeRef={nodeRef}
      in={inProp}
      timeout={timeout}
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
