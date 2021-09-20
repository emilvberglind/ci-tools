import React, {useContext, useState} from 'react';
import {Button, CodeBlock, CodeBlockCode} from '@patternfly/react-core';
import {AuthContext, ConfigContext, WizardContext} from "@app/types";
import {marshallConfig} from "@app/utils/utils";
import {ConfigEditor} from "@app/ConfigEditor/ConfigEditor";

const Generate: React.FunctionComponent = () => {
  const authContext = useContext(AuthContext)
  const context = useContext(WizardContext);
  const configContext = useContext(ConfigContext);
  const [isLoading, setIsLoading] = useState(false)

  function submit(generatePR : boolean) {
    alert("test");
    setIsLoading(true);
    fetch(process.env.API_URI  + '/configs?generatePR=' + generatePR, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'access_token': authContext.userData.token,
        'github_user': authContext.userData.userName
      },
      body: JSON.stringify(marshallConfig(configContext.config))
    })
      .then((r) => {
        if (r.status === 200) {
          context.setStep({...context.step, errorMessage: "", stepIsComplete: true});
          r.text().then(text => {
            alert("New Repo: " + text);
          });
        } else {
          context.setStep({
            ...context.step,
            errorMessages: ["Whoops!"],
            stepIsComplete: false
          });
        }
        setIsLoading(false);
      })
      .catch((e) => {
        context.setStep({
          ...context.step,
          errorMessages: ["Uh oh!"],
          stepIsComplete: false
        });
        setIsLoading(false);
      });
  }

  return <React.Fragment>
    Does this look ok?
    <ConfigEditor readOnly={true}/>
    <Button
      variant="primary"
      isLoading={isLoading}
      spinnerAriaValueText={isLoading ? 'Loading' : undefined}
      onClick={() => submit(false)}>Generate Configuration</Button>
    <Button
      variant="primary"
      isLoading={isLoading}
      spinnerAriaValueText={isLoading ? 'Loading' : undefined}
      onClick={() => submit(true)}>Generate Configuration and Pull Request</Button>
  </React.Fragment>
}

export {Generate}
