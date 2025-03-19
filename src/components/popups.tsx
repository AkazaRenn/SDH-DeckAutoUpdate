import { ReactNode } from "react";
import { ConfirmModal, showModal, TextField } from "@decky/ui";

export function textInputPopup(title: ReactNode, value: string, onOK: (value: string) => void) {
  let textFieldValue = value;

  showModal(
    <ConfirmModal
      strTitle={title}
      onOK={() => onOK(textFieldValue)}>
      <TextField
        defaultValue={value}
        onBlur={(e) => {
          textFieldValue = e.target.value;
        }} />
    </ConfirmModal>
  );
}

export function confirmPopup(title: ReactNode, text: ReactNode, onOK?: () => void, okText?: string, cancelText?: string) {
  showModal(
    <ConfirmModal
      strTitle={title}
      strDescription={text}
      onOK={onOK}
      strOKButtonText={okText}
      strCancelButtonText={cancelText}
    />)
}