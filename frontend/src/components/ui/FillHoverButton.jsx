// From Uiverse.io by cssbuttons-io - https://uiverse.io/cssbuttons-io/slippery-jellyfish-67
// MIT License, Copyright (c) cssbuttons-io (cssbuttons.io)

/**
 * Botón con relleno circular al hover (Uiverse slippery-jellyfish-67).
 * Variantes: primary | danger.
 */
export default function FillHoverButton({
  children,
  className = '',
  variant = 'primary',
  type = 'button',
  disabled = false,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`ev-fill-btn ev-fill-btn--${variant} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  )
}
