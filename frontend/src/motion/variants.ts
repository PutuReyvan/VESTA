import type { Variants } from 'motion/react'
import { motionDurations, motionEase, motionStagger, motionStaggerCap } from './tokens'

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: motionDurations.standard, ease: motionEase },
  },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: motionDurations.standard, ease: motionEase },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: motionDurations.standard, ease: motionEase },
  },
}

export function staggerContainer(itemCount: number): Variants {
  const intervals = Math.max(itemCount - 1, 1)
  return {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: Math.min(motionStagger, motionStaggerCap / intervals),
      },
    },
  }
}

export const presenceFade: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: motionDurations.fast, ease: motionEase },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: motionDurations.fast, ease: motionEase },
  },
}
