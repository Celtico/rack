import { Button, Dialog, Portal, Text } from "@chakra-ui/react"

/**
 * "Are you sure?" — a small modal with a question, a Cancel and one action.
 * `open` is the question to ask (null: closed); `onAnswer` gets true for the
 * action, false for Cancel, Escape or a click outside.
 */
export function ConfirmDialog({
  open,
  title,
  action,
  onAnswer,
}: {
  open: string | null
  title: string
  action: string
  onAnswer: (yes: boolean) => void
}) {
  return (
    <Dialog.Root
      role="alertdialog"
      open={open !== null}
      onOpenChange={(d) => {
        if (!d.open) onAnswer(false)
      }}
      // Cancel and Escape close it, a press outside does not: opened by a drop, the pointer's release
      // that ends the drag lands right after and would shut it before it was seen.
      closeOnInteractOutside={false}
      size="xs"
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="rack.panel" color="rack.silkscreen" rounded="sm">
            <Dialog.Header>
              <Dialog.Title textStyle="silkscreen" fontSize="sm" fontWeight="bold">
                {title}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>{open}</Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button size="sm" rounded="sm" variant="outline">
                  Cancel
                </Button>
              </Dialog.ActionTrigger>
              <Button
                size="sm"
                rounded="sm"
                variant="solid"
                colorPalette="red"
                onClick={() => onAnswer(true)}
              >
                {action}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
