# VESTA motion

Motion is presentation-only. It must not change wallet, transaction, contract,
authorization, validation, or vesting data behavior.

## Shared tokens

Motion tokens live in `src/motion/tokens.ts`:

- `fast`: 180ms
- `standard`: 260ms
- `slow`: 360ms
- `snappy`, `smooth`, and `gentle` springs
- ease-out curve: `[0.22, 1, 0.36, 1]`
- stagger interval: 40ms

Keep UI feedback between 150ms and 400ms. Animate `transform` and `opacity`
where possible. Progress indicators may use `scaleX` with a left transform
origin.

## Primitives

Shared primitives are in `src/motion/primitives.tsx`:

- `Reveal`: viewport-triggered fade and upward shift
- `Stagger` / `StaggerItem`: capped sequential entrances
- `PageTransition`: route-level transition
- `Pressable`: spring hover and press feedback
- `AnimatedNumber`: transitions numeric display values while preserving the
  supplied formatter
- `Skeleton`: looping loading presentation
- `Presence`: enter/exit wrapper

Use `MotionConfig` from `src/main.tsx`; it is configured with
`reducedMotion="user"`.

## Rules for new motion

1. State the user-facing purpose of each animation before adding it.
2. Do not animate business state, contract calls, validation, or navigation
   timing.
3. Do not calculate vesting values for animation.
4. Preserve keyboard focus and the existing component APIs.
5. Add `prefers-reduced-motion` behavior for CSS transitions and rely on
   `MotionConfig` for Motion components.
6. Avoid animating layout properties such as width, height, top, or left.
7. Keep list staggers short and capped.

The development-only primitive preview is available at `?motion-demo`.
