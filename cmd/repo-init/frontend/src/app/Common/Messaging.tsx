import React from "react";
import {Alert, AlertGroup} from "@patternfly/react-core";

export const ErrorMessage = (props) => {
  if (props.messages && props.messages.length > 0) {
    return (
      <AlertGroup>
        {props.messages.map((message, i) => {
          return <Alert key={"error_" + i} variant="danger" title={message}/>
        })}
      </AlertGroup>
    );
  } else if (props.message && props.message.trim()) {
    return (
      <Alert variant="danger" title={props.message}/>
    )
  }
  return <div/>
}
