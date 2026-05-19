import { createElement, insert, setProp, effect } from "@opentui/solid"

export function ModeIndicator(props: {
  mode: "normal" | "insert"
  theme: any
}) {
  const el = createElement("box")
  const textEl = createElement("text")
  insert(el, textEl)
  setProp(el, "paddingLeft", 1)
  setProp(el, "paddingRight", 1)
  effect(() => {
    const color = props.mode === "normal"
      ? props.theme.current.warning
      : props.theme.current.success
    setProp(textEl, "fg", color)
    setProp(textEl, "bold", true)
  })
  insert(textEl, () => props.mode === "normal" ? "NORMAL" : "INSERT")
  return el
}
