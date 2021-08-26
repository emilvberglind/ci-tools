import React, {useContext, useState} from 'react';
import {Button, CodeBlock, CodeBlockCode} from '@patternfly/react-core';
import {AuthContext, WizardContext} from "@app/types";
import {marshallConfig} from "@app/utils/utils";

const Finalize: React.FunctionComponent = () => {
  const authContext = useContext(AuthContext)
  const context = useContext(WizardContext);
  const [isLoading, setIsLoading] = useState(false)

  function submit() {
    setIsLoading(true);
    fetch('http://localhost:8080/api/configs', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'access_token': authContext.userData.token,
      },
      body: JSON.stringify(marshallConfig(context.config))
    })
      .then((r) => {
        if (r.status === 200) {
          context.setStep({...context.step, errorMessage: "", stepIsComplete: true});
        } else {
          context.setStep({
            ...context.step,
            errorMessage: "Whoops!",
            stepIsComplete: false
          });
        }
        setIsLoading(false);
      })
      .catch((e) => {
        context.setStep({
          ...context.step,
          errorMessage: "Uh oh!",
          stepIsComplete: false
        });
        setIsLoading(false);
      });
  }

  return <React.Fragment>
    Does this look good?
    <CodeBlock>
      <CodeBlockCode>
        {JSON.stringify(context.config, null, 2)}
      </CodeBlockCode>
    </CodeBlock>
    <Button
      variant="primary"
      isLoading={isLoading}
      spinnerAriaValueText={isLoading ? 'Loading' : undefined}
      onClick={submit}>Save!</Button>
  </React.Fragment>
}

export {Finalize}
