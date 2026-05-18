/** @jsxImportSource @opentui/solid */

export function ModeIndicator(props: {
  mode: "normal" | "insert"
  theme: any
}) {
  const label = props.mode === "normal" ? "NORMAL" : "INSERT"
  const color = props.mode === "normal"
    ? props.theme.current.warning
    : props.theme.current.success
  return (
    <box paddingLeft={1} paddingRight={1}>
      <text fg={color} bold>{label}</text>
    </box>
  )
}
