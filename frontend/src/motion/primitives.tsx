import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type HTMLMotionProps,
} from 'motion/react'
import { Children, type ReactNode } from 'react'
import { fade, fadeUp, presenceFade, staggerContainer } from './variants'
import { motionSprings } from './tokens'
import { useEffect } from 'react'

export function Reveal({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
    >
      {children}
    </motion.div>
  )
}

export function Stagger({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer(Children.count(children))}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <motion.div className={className} variants={fadeUp}>{children}</motion.div>
}

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      exit="hidden"
    >
      {children}
    </motion.div>
  )
}

export function Pressable({
  children,
  ...props
}: HTMLMotionProps<'button'>) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={motionSprings.snappy}
      {...props}
    >
      {children}
    </motion.button>
  )
}

export function AnimatedNumber({
  value,
  format = (number) => String(Math.round(number)),
}: {
  value: number
  format?: (value: number) => string
}) {
  const source = useMotionValue(value)
  const spring = useSpring(source, motionSprings.smooth)
  const display = useTransform(spring, (latest) => format(latest))

  useEffect(() => {
    source.set(value)
  }, [source, value])

  return <motion.span>{display}</motion.span>
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <motion.div
      className={className}
      variants={fade}
      initial="hidden"
      animate="visible"
      transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
    />
  )
}

export function Presence({
  present,
  children,
}: {
  present: boolean
  children: ReactNode
}) {
  return (
    <AnimatePresence initial={false}>
      {present && (
        <motion.div variants={presenceFade} initial="hidden" animate="visible" exit="exit">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

