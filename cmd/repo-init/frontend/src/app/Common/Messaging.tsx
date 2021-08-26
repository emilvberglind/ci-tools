import React from "react";
import {Alert} from "@patternfly/react-core";

export const ErrorMessage = (props) => {
  if (props.errorMsg && props.errorMsg.trim()) {
    return (
      <Alert variant="danger" title={props.errorMsg}/>
    )
  }
  return <div/>
}
